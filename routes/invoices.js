// routes/invoices.js
const express = require("express");
const router = express.Router();
const Invoice = require("../models/Invoice");
const User = require("../models/User");
const jwt = require("jsonwebtoken");

// Helper: extraer token tanto si viene "Bearer xxx" como si viene solo "xxx"
function getTokenFromHeader(header) {
  if (!header) return null;
  if (header.startsWith("Bearer ")) return header.split(" ")[1];
  return header;
}

// Middleware de autenticación
const authMiddleware = (req, res, next) => {
  const raw = req.headers.authorization;
  const token = getTokenFromHeader(raw);
  if (!token) return res.status(403).json({ message: "No autorizado" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    req.userEmail = decoded.email;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Token inválido" });
  }
};

// Estados válidos (mantener consistencia)
const VALID_STATUSES = [
  "Pendiente",
  "Comprobante Subido",
  "Pagada",
  "Rechazada",
];

/* -------------------------------
   Crear factura (emisor)
   POST /api/invoices/
---------------------------------*/
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { toUserEmail, price, service, comments, date } = req.body;
    if (!toUserEmail || !price || !service) {
      return res.status(400).json({ message: "Faltan datos requeridos" });
    }

    const user = await User.findById(req.userId);
    if (!user)
      return res.status(404).json({ message: "Usuario no encontrado" });

    const recipient = await User.findOne({ email: toUserEmail });
    if (!recipient) {
      return res
        .status(400)
        .json({ message: "El correo destinatario no existe" });
    }

    const invoice = new Invoice({
      toUserEmail,
      price,
      service,
      comments,
      date,
      createdBy: user.name,
      createdByEmail: user.email,
      status: "Pendiente",
    });

    await invoice.save();
    res.status(201).json(invoice);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al crear factura" });
  }
});

/* -------------------------------
   Facturas recibidas (todas)
   GET /api/invoices/received
---------------------------------*/
router.get("/received", authMiddleware, async (req, res) => {
  try {
    const invoices = await Invoice.find({ toUserEmail: req.userEmail }).sort({
      createdAt: -1,
    });
    res.json(invoices);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener facturas recibidas" });
  }
});

/* -------------------------------
   Facturas recibidas pendientes
   GET /api/invoices/pending
---------------------------------*/
router.get("/pending", authMiddleware, async (req, res) => {
  try {
    const invoices = await Invoice.find({
      toUserEmail: req.userEmail,
      status: "Pendiente",
    }).sort({ createdAt: -1 });
    res.json(invoices);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener facturas pendientes" });
  }
});

/* -------------------------------
   Facturas enviadas (emisor)
   GET /api/invoices/sent
---------------------------------*/
router.get("/sent", authMiddleware, async (req, res) => {
  try {
    const invoices = await Invoice.find({ createdByEmail: req.userEmail }).sort(
      { createdAt: -1 }
    );
    res.json(invoices);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener facturas enviadas" });
  }
});

/* -------------------------------
   Receptor sube comprobante (base64)
   POST /api/invoices/:id/upload-proof
   -> solo quien es destinatario (toUserEmail)
   -> set status = "Comprobante Subido"
---------------------------------*/
router.post("/:id/upload-proof", authMiddleware, async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res
        .status(400)
        .json({ message: "Se requiere una imagen (imageBase64)" });
    }

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice)
      return res.status(404).json({ message: "Factura no encontrada" });

    // Only recipient can upload proof
    if (invoice.toUserEmail !== req.userEmail) {
      return res.status(403).json({
        message: "No autorizado: solo el destinatario puede subir comprobante",
      });
    }

    invoice.paymentImage = imageBase64;
    invoice.status = "Comprobante Subido";
    // opcional: guardar historial
    invoice.history = invoice.history || [];
    invoice.history.push({
      action: "upload-proof",
      by: req.userEmail,
      date: new Date(),
    });

    await invoice.save();
    res.json({ message: "Comprobante subido correctamente", invoice });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al subir comprobante" });
  }
});

/* -------------------------------
   Emisor valida comprobante
   POST /api/invoices/:id/validate
   body: { status: "Pagada" | "Rechazada" }
   -> solo quien creó la factura (createdByEmail)
---------------------------------*/
router.post("/:id/validate", authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !["Pagada", "Rechazada"].includes(status)) {
      return res
        .status(400)
        .json({ message: "Estado inválido. Debe ser 'Pagada' o 'Rechazada'." });
    }

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice)
      return res.status(404).json({ message: "Factura no encontrada" });

    // Only emitter/creator can validate
    if (invoice.createdByEmail !== req.userEmail) {
      return res
        .status(403)
        .json({ message: "No autorizado: solo el emisor puede validar" });
    }

    invoice.status = status;
    invoice.history = invoice.history || [];
    invoice.history.push({
      action: `validate-${status}`,
      by: req.userEmail,
      date: new Date(),
    });

    await invoice.save();
    res.json({ message: `Factura marcada como ${status}`, invoice });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al validar factura" });
  }
});

/* -------------------------------
   PUT genérico para actualizar status (compatibilidad)
   PUT /api/invoices/:id/status
   -> se validan roles según el status solicitado
---------------------------------*/
router.put("/:id/status", authMiddleware, async (req, res) => {
  try {
    let { status } = req.body;
    if (!status) return res.status(400).json({ message: "Estado requerido" });

    status = status.trim();

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Estado inválido" });
    }

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice)
      return res.status(404).json({ message: "Factura no encontrada" });

    // Reglas según roles
    if (
      status === "Comprobante Subido" &&
      invoice.toUserEmail !== req.userEmail
    ) {
      return res
        .status(403)
        .json({ message: "Solo el destinatario puede subir comprobante" });
    }
    if (
      (status === "Pagada" || status === "Rechazada") &&
      invoice.createdByEmail !== req.userEmail
    ) {
      return res
        .status(403)
        .json({ message: "Solo el emisor puede marcar Pagada/Rechazada" });
    }
    if (status === "Pendiente" && invoice.createdByEmail !== req.userEmail) {
      return res
        .status(403)
        .json({ message: "Solo el emisor puede reiniciar a Pendiente" });
    }

    invoice.status = status;
    invoice.history = invoice.history || [];
    invoice.history.push({
      action: `status-${status}`,
      by: req.userEmail,
      date: new Date(),
    });

    await invoice.save();
    res.json({ message: "Estado actualizado correctamente", invoice });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al actualizar estado" });
  }
});

module.exports = router;
