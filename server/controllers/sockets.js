import geolib from "geolib";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import Ride from "../models/Ride.js";
import FoodOrder from "../models/FoodOrder.js";
import Restaurant from "../models/Restaurant.js";
import ChatMessage from "../models/ChatMessage.js";

const isValidId = (id) => typeof id === "string" && mongoose.isValidObjectId(id);

import {
  setOnDutyRider,
  deleteOnDutyRider,
  hasOnDutyRider,
  updateOnDutyRiderCoords,
  getOnDutyRidersEntries,
  getOnDutyRider,
} from "../utils/onDutyRidersRegistry.js";
import { getSettings } from "../utils/tripSettlement.js";
import { canRiderReceiveOffer } from "../utils/riderServiceEligibility.js";
import {
  filterRidesForRider,
  emitRankedOfferToRiders,
} from "../utils/rideOfferBroadcast.js";
import { riderHasActiveRide, ACTIVE_RIDE_STATUSES } from "../utils/riderActiveRide.js";
import { rankEligibleRidersForRide } from "../utils/offerRanking.js";
import { clearExpiredPauses } from "../utils/riderReliability.js";

const handleSocketConnection = (io) => {
  io.use(async (socket, next) => {
    try {
      // Support both auth object (works with websocket) and headers (polling)
      const token =
        socket.handshake.auth?.access_token ||
        socket.handshake.auth?.token ||
        socket.handshake.headers?.access_token;
      if (!token) return next(new Error("Authentication invalid: No token"));

      const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      const user = await User.findById(payload.id);
      if (!user) return next(new Error("Authentication invalid: User not found"));

      socket.user = { id: payload.id, role: user.role };
      next();
    } catch (error) {
      console.error("Socket Auth Error:", error);
      next(new Error("Authentication invalid: Token verification failed"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.user;
    console.log(`User Joined: ${user.id} (${user.role})`);

    if (user.role === "rider") {
      socket.on("goOnDuty", async (coords) => {
        const riderUser = await User.findById(user.id).select("driverDetails");
        const status = riderUser?.driverDetails?.status;
        if (status !== "active") {
          socket.emit("error", {
            message:
              status === "suspended_debt"
                ? "Clear your commission balance before going on duty."
                : "Your driver account is not active. Contact admin.",
          });
          return;
        }
        await clearExpiredPauses(user.id);
        setOnDutyRider(user.id, { socketId: socket.id, coords });
        socket.join("onDuty");
        socket.join(`rider_${user.id}`);
        console.log(`rider ${user.id} is now on duty.`);
        
        // Update DB status
        await User.findByIdAndUpdate(user.id, {
          isOnline: true,
          currentLocation: {
            type: 'Point',
            coordinates: [coords.longitude, coords.latitude]
          }
        });

        // Replay open offers (food + rides) so riders who just went on duty don't miss broadcasts
        try {
          if (await riderHasActiveRide(user.id)) {
            const active = await Ride.findOne({
              rider: user.id,
              status: { $in: ACTIVE_RIDE_STATUSES },
            })
              .populate("customer", "name phone averageRating totalRatings")
              .lean();
            if (active) {
              socket.emit("rideAssigned", active);
            }
            updateNearbyriders();
            return;
          }
          const since = new Date(Date.now() - 45 * 60 * 1000);
          const pending = await Ride.find({
            status: "SEARCHING_FOR_RIDER",
            createdAt: { $gte: since },
          })
            .populate("customer", "name phone averageRating totalRatings")
            .sort({ createdAt: -1 })
            .limit(20);
          const settings = await getSettings();
          const eligible = await filterRidesForRider(pending, riderUser, settings, coords);
          eligible.forEach((ride) => socket.emit("rideOffer", ride));
          if (eligible.length > 0) {
            console.log(`[goOnDuty] sent ${eligible.length} eligible offer(s) to rider ${user.id}`);
          }
        } catch (err) {
          console.error("[goOnDuty] pending offers replay failed:", err);
        }

        updateNearbyriders();
      });

      socket.on("goOffDuty", async () => {
        deleteOnDutyRider(user.id);
        socket.leave("onDuty");
        socket.leave(`rider_${user.id}`);
        console.log(`rider ${user.id} is now off duty.`);

        // Update DB so admin and others see driver as offline
        try {
          await User.findByIdAndUpdate(user.id, { isOnline: false });
        } catch (err) {
          console.error("Failed to set rider offline in DB:", err);
        }
        updateNearbyriders();
      });

      socket.on("updateLocation", async (coords) => {
        const latitude = Number(coords?.latitude);
        const longitude = Number(coords?.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

        const payload = {
          riderId: String(user.id),
          coords: {
            latitude,
            longitude,
            heading: Number(coords?.heading) || 0,
          },
        };

        if (hasOnDutyRider(user.id)) {
          updateOnDutyRiderCoords(user.id, payload.coords);
          updateNearbyriders();
        }

        User.findByIdAndUpdate(user.id, {
          currentLocation: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
        }).catch((err) => console.error("Failed to update rider location in DB", err));

        io.to(`rider_${user.id}`).emit("riderLocationUpdate", payload);

        try {
          const activeRide = await Ride.findOne({
            rider: user.id,
            status: { $in: ACTIVE_RIDE_STATUSES },
          })
            .select("_id")
            .lean();
          if (activeRide) {
            if (!hasOnDutyRider(user.id)) {
              setOnDutyRider(user.id, { socketId: socket.id, coords: payload.coords });
            }
            io.to(`ride_${activeRide._id}`).emit("riderLocationUpdate", payload);
          }
        } catch (err) {
          console.error("rider location ride fanout failed:", err);
        }
      });
    }

    if (user.role === "customer") {
      socket.on("subscribeToZone", (customerCoords) => {
        socket.user.coords = customerCoords;
        sendNearbyRiders(socket, customerCoords).catch(err => console.error("Error sending nearby riders:", err));
      });

      socket.on("searchrider", async (rideId) => {
        try {
          const ride = await Ride.findById(rideId).populate("customer", "name phone averageRating totalRatings").populate("rider");
          if (!ride) return socket.emit("error", { message: "Ride not found" });

          const { latitude: pickupLat, longitude: pickupLon } = ride.pickup;

          let retries = 0;
          let rideAccepted = false;
          let canceled = false;
          const MAX_RETRIES = 20;

          const retrySearch = async () => {
            if (canceled) return;
            retries++;

            // Re-populate customer with rating info for each retry
            const rideWithCustomer = await Ride.findById(rideId).populate("customer", "name phone averageRating totalRatings");
            const offered = await sendNearbyRiders(
              socket,
              { latitude: pickupLat, longitude: pickupLon },
              rideWithCustomer,
              retries
            );
            console.log(`[searchrider] ride ${rideId} retry ${retries}: ${offered} rider(s) offered`);
            if (offered > 0 || retries >= MAX_RETRIES) {
              clearInterval(retryInterval);
              if (!rideAccepted && retries >= MAX_RETRIES) {
                await Ride.findByIdAndDelete(rideId);
                socket.emit("error", { message: "No riders found within 5 minutes." });
              }
            }
          };

          const retryInterval = setInterval(retrySearch, 10000);
          // Run first search immediately so riders get the offer right away
          retrySearch();

          socket.on("rideAccepted", () => {
            rideAccepted = true;
            clearInterval(retryInterval);
          });

          socket.on("cancelRide", async () => {
            canceled = true;
            clearInterval(retryInterval);
            await Ride.findByIdAndDelete(rideId);
            socket.emit("rideCanceled", { message: "Ride canceled" });

            if (ride.rider) {
              const riderSocket = getRiderSocket(ride.rider._id);
              riderSocket?.emit("rideCanceled", { rideId, message: "Ride canceled by customer." });
            }
            // Tell all on-duty riders to remove this offer from their list
            io.to("onDuty").emit("rideCanceled", { rideId, message: "Ride no longer available." });
            console.log(`Customer ${user.id} canceled ride ${rideId}`);
          });
        } catch (error) {
          console.error("Error searching for rider:", error);
          socket.emit("error", { message: "Error searching for rider" });
        }
      });
    }

    socket.on("subscribeToriderLocation", async (riderId) => {
      if (!riderId) return;
      const id = String(riderId);
      socket.join(`rider_${id}`);

      const onDuty = getOnDutyRider(id);
      if (onDuty?.coords) {
        socket.emit("riderLocationUpdate", { riderId: id, coords: onDuty.coords });
        console.log(`User ${user.id} subscribed to rider ${id}'s location (live).`);
        return;
      }

      try {
        const riderUser = await User.findById(id).select("currentLocation").lean();
        const coordinates = riderUser?.currentLocation?.coordinates;
        if (Array.isArray(coordinates) && coordinates.length >= 2) {
          const [longitude, latitude] = coordinates;
          socket.emit("riderLocationUpdate", {
            riderId: id,
            coords: { latitude, longitude, heading: 0 },
          });
        }
        console.log(`User ${user.id} subscribed to rider ${id}'s location.`);
      } catch (err) {
        console.error("subscribeToriderLocation error:", err);
      }
    });

    socket.on("subscribeRide", async (rideId) => {
      if (!isValidId(rideId)) {
        socket.emit("error", { message: "Invalid ride id" });
        return;
      }
      socket.join(`ride_${rideId}`);
      try {
        const rideData = await Ride.findById(rideId)
          .populate("customer", "name phone averageRating totalRatings")
          .populate("rider", "name phone averageRating totalRatings currentLocation");
        socket.emit("rideData", rideData);
      } catch (error) {
        console.error("subscribeRide error:", error);
        socket.emit("error", { message: "Failed to receive ride data" });
      }
    });

    socket.on("subscribeFoodOrder", async (orderId) => {
      if (!isValidId(orderId)) {
        socket.emit("error", { message: "Invalid order id" });
        return;
      }
      socket.join(`food_order_${orderId}`);
      if (user.role === "customer") {
        socket.join(`customer_${user.id}`);
      }
      try {
        const order = await FoodOrder.findById(orderId)
          .populate("restaurant", "name cuisine imageEmoji address")
          .populate("ride")
          .lean();
        if (order) socket.emit("foodOrderUpdated", order);
      } catch (error) {
        socket.emit("error", { message: "Failed to load food order" });
      }
    });

    // Merchant/cook kitchen console: live order feed for their restaurant
    socket.on("subscribeRestaurant", async (restaurantId) => {
      if (!isValidId(restaurantId)) {
        socket.emit("error", { message: "Invalid restaurant id" });
        return;
      }
      try {
        let authorized = false;
        if (user.role === "merchant") {
          const owned = await Restaurant.exists({ _id: restaurantId, owner: user.id });
          authorized = !!owned;
        } else if (user.role === "cook") {
          const cook = await User.findById(user.id).select("restaurant");
          authorized = cook && String(cook.restaurant) === String(restaurantId);
        }
        if (!authorized) {
          socket.emit("error", { message: "Not allowed for this restaurant" });
          return;
        }
        socket.join(`restaurant_${restaurantId}`);
        console.log(`${user.role} ${user.id} subscribed to restaurant ${restaurantId}`);
      } catch (error) {
        console.error("subscribeRestaurant error:", error);
        socket.emit("error", { message: "Failed to subscribe to restaurant" });
      }
    });

    socket.on("unsubscribeRestaurant", (restaurantId) => {
      if (isValidId(restaurantId)) {
        socket.leave(`restaurant_${restaurantId}`);
      }
    });

    // Chat functionality
    socket.on("joinChat", (rideId) => {
      socket.join(`chat_${rideId}`);
      console.log(`User ${user.id} joined chat for ride ${rideId}`);
    });

    socket.on("leaveChat", (rideId) => {
      socket.leave(`chat_${rideId}`);
      console.log(`User ${user.id} left chat for ride ${rideId}`);
    });

    socket.on("getChatHistory", async (rideId) => {
      try {
        const messages = await ChatMessage.find({ ride: rideId })
          .populate("sender", "name phone")
          .sort({ createdAt: 1 })
          .limit(100);

        const formattedMessages = messages.map((msg) => ({
          _id: msg._id,
          senderId: msg.sender._id.toString(),
          senderName: msg.sender.name,
          text: msg.text,
          image: msg.image,
          timestamp: msg.createdAt,
          isQuickMessage: msg.isQuickMessage,
        }));

        socket.emit("chatHistory", formattedMessages);
      } catch (error) {
        console.error("Error fetching chat history:", error);
        socket.emit("error", { message: "Failed to load chat history" });
      }
    });

    socket.on("sendChatMessage", async ({ rideId, message }) => {
      try {
        // Verify user is part of this ride
        const ride = await Ride.findById(rideId);
        if (!ride) {
          socket.emit("error", { message: "Ride not found" });
          return;
        }

        const isAuthorized =
          ride.customer.toString() === user.id ||
          (ride.rider && ride.rider.toString() === user.id);

        if (!isAuthorized) {
          socket.emit("error", { message: "Unauthorized" });
          return;
        }

        // Save message to database
        const chatMessage = new ChatMessage({
          ride: rideId,
          sender: user.id,
          text: message.text,
          image: message.image,
          isQuickMessage: message.isQuickMessage || false,
        });

        await chatMessage.save();
        await chatMessage.populate("sender", "name phone");

        // Format message for clients
        const formattedMessage = {
          _id: chatMessage._id,
          senderId: chatMessage.sender._id.toString(),
          senderName: chatMessage.sender.name,
          text: chatMessage.text,
          image: chatMessage.image,
          timestamp: chatMessage.createdAt,
          isQuickMessage: chatMessage.isQuickMessage,
        };

        // Broadcast to all users in the chat room
        io.to(`chat_${rideId}`).emit("chatMessage", formattedMessage);
      } catch (error) {
        console.error("Error sending chat message:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    socket.on("disconnect", () => {
      if (user.role === "rider") {
        deleteOnDutyRider(user.id);
        socket.leave(`rider_${user.id}`);
        // Mark driver offline in DB so admin page and others see correct status
        User.findByIdAndUpdate(user.id, { isOnline: false }).catch((err) =>
          console.error("Failed to set rider offline on disconnect:", err)
        );
        updateNearbyriders();
      }
      console.log(`${user.role} ${user.id} disconnected.`);
    });

    function updateNearbyriders() {
      io.sockets.sockets.forEach((socket) => {
        if (socket.user?.role === "customer") {
          const customerCoords = socket.user.coords;
          if (customerCoords) sendNearbyRiders(socket, customerCoords).catch(err => console.error("Error updating nearby riders:", err));
        }
      });
    }

    async function sendNearbyRiders(socket, location, ride = null, retryIndex = 1) {
      const settings = ride ? await getSettings() : null;
      const nearbyriders = getOnDutyRidersEntries()
        .map(([riderId, data]) => ({
          id: riderId,
          socketId: data.socketId,
          coords: data.coords,
          distance: geolib.getDistance(data.coords, location),
        }))
        .filter((rider) => rider.distance <= 60000)
        .sort((a, b) => a.distance - b.distance);

      socket.emit("nearbyriders", nearbyriders);

      if (ride) {
        let rideWithCustomer = ride;
        if (!ride.customer || typeof ride.customer !== "object") {
          rideWithCustomer = await Ride.findById(ride._id).populate(
            "customer",
            "name phone averageRating totalRatings"
          );
        }

        const riderIds = nearbyriders.map((r) => r.id);
        const riders = riderIds.length
          ? await User.find({ _id: { $in: riderIds } }).select("role driverDetails")
          : [];
        const riderById = new Map(riders.map((r) => [r._id.toString(), r]));

        const eligibleForRank = [];
        for (const nearby of nearbyriders) {
          const riderUser = riderById.get(String(nearby.id));
          if (riderUser && canRiderReceiveOffer(riderUser, rideWithCustomer, settings)) {
            eligibleForRank.push({
              rider: riderUser,
              coords: nearby.coords,
              socketId: nearby.socketId,
            });
          }
        }

        const ranked = rankEligibleRidersForRide(
          eligibleForRank.map((e) => ({ rider: e.rider, coords: e.coords })),
          rideWithCustomer,
          settings
        ).map((row) => ({
          ...row,
          socketId: eligibleForRank.find((e) => e.rider._id.toString() === row.rider._id.toString())
            ?.socketId,
        }));

        return emitRankedOfferToRiders(io, rideWithCustomer, ranked, retryIndex);
      }

      return nearbyriders.length;
    }

    function getRiderSocket(riderId) {
      const rider = getOnDutyRider(riderId);
      return rider ? io.sockets.sockets.get(rider.socketId) : null;
    }
  });
};

export default handleSocketConnection;
