// Reports of the other person in an in-trip chat, and how admins follow them up.
import mongoose from "mongoose";
import { StatusCodes } from "http-status-codes";
import ChatReport from "../models/ChatReport.js";
import ChatMessage from "../models/ChatMessage.js";
import Ride from "../models/Ride.js";
import { BadRequestError, NotFoundError } from "../errors/index.js";

export const CHAT_REPORT_REASONS = ["ABUSIVE", "HARASSMENT", "SPAM", "SAFETY", "OTHER"];

/** POST /ride/:rideId/chat-report { reason, details? } — the customer or rider on the trip. */
export const reportChat = async (req, res) => {
  const { rideId } = req.params;
  if (!mongoose.isValidObjectId(rideId)) throw new BadRequestError("Invalid ride id");
  const reason = String(req.body.reason || "");
  if (!CHAT_REPORT_REASONS.includes(reason)) throw new BadRequestError("Choose a reason for the report");

  const ride = await Ride.findById(rideId).select("customer rider").lean();
  if (!ride) throw new NotFoundError("Trip not found");

  const customer = ride.customer?.toString();
  const rider = ride.rider?.toString();
  // Not 401: the app treats that as signed out.
  if (req.user.id !== customer && req.user.id !== rider) throw new NotFoundError("Trip not found");
  const reportedUser = req.user.id === customer ? rider : customer;
  if (!reportedUser) throw new BadRequestError("There is no one to report on this trip yet");

  const messages = await ChatMessage.find({ ride: rideId }).sort({ createdAt: 1 }).limit(200).lean();
  await ChatReport.create({
    ride: rideId,
    reporter: req.user.id,
    reportedUser,
    reason,
    details: String(req.body.details || "").trim().slice(0, 1000),
    messages: messages.map((m) => ({ sender: m.sender, text: m.text, image: m.image, sentAt: m.createdAt })),
  });

  res.status(StatusCodes.CREATED).json({ message: "Report received" });
};

/** GET /admin/chat-reports?status=open|resolved|all */
export const adminListChatReports = async (req, res) => {
  const status = String(req.query.status || "open");
  const query = status === "all" ? {} : { status };
  const [reports, counts] = await Promise.all([
    ChatReport.find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("reporter", "name phone role")
      .populate("reportedUser", "name phone role")
      .lean(),
    ChatReport.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);
  res.status(StatusCodes.OK).json({
    reports,
    counts: Object.fromEntries(counts.map((c) => [c._id, c.count])),
  });
};

/** PATCH /admin/chat-reports/:id { status?: open | resolved, note? } */
export const adminUpdateChatReport = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new BadRequestError("Invalid report id");
  const report = await ChatReport.findById(req.params.id);
  if (!report) throw new NotFoundError("Report not found");
  const { status } = req.body;
  if (status !== undefined) {
    if (!["open", "resolved"].includes(status)) throw new BadRequestError("Status must be open or resolved");
    report.status = status;
  }
  if (req.body.note !== undefined) report.note = String(req.body.note || "").trim().slice(0, 1000) || null;
  report.handledBy = req.user.id;
  report.handledAt = new Date();
  await report.save();
  res.status(StatusCodes.OK).json({ report });
};
