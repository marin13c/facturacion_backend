// models/Invoice.js
const mongoose = require("mongoose");

const InvoiceSchema = new mongoose.Schema({
  toUserEmail: { type: String, required: true },
  price: { type: Number, required: true },
  service: { type: String, required: true },
  comments: { type: String },
  date: { type: Date, default: Date.now },
  createdBy: { type: String },
  createdByEmail: { type: String },
  status: { type: String, default: "Pendiente" },
  paymentImage: { type: String }, // base64
  history: [
    {
      action: String,
      by: String,
      date: Date,
    },
  ],
});

module.exports =
  mongoose.models.Invoice || mongoose.model("Invoice", InvoiceSchema);
