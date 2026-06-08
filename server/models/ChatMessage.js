import mongoose from 'mongoose';

const { Schema } = mongoose;

const chatMessageSchema = new Schema(
  {
    ride: {
      type: Schema.Types.ObjectId,
      ref: 'Ride',
      required: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      default: null,
    },
    image: {
      type: String,
      default: null,
    },
    isQuickMessage: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
chatMessageSchema.index({ ride: 1, createdAt: -1 });

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
export default ChatMessage;
