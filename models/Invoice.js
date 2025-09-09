const mongoose = require("mongoose");

const InvoiceSchema = new mongoose.Schema(
  {
    toUserEmail: { type: String, required: true },
    price: { type: Number, required: true },
    service: { type: String, required: true },
    comments: { type: String },
    date: { type: Date },
    status: {
      type: String,
      enum: ["Pendiente", "Pagada", "Cancelada"],
      default: "Pendiente",
    },

    createdBy: { type: String, required: true }, // nombre del creador
    createdByEmail: { type: String, required: true }, // correo del creador
  },
  { timestamps: true }
);

// ⚠️ Exportar correctamente para CommonJS
const Invoice =
  mongoose.models.Invoice || mongoose.model("Invoice", InvoiceSchema);
module.exports = Invoice;
