const express = require("express");
const router = express.Router();
const Invoice = require("../models/Invoice");
const User = require("../models/User");
const jwt = require("jsonwebtoken");

// Middleware para validar token
const authMiddleware = (req, res, next) => {
  const token = req.headers["authorization"];
  if (!token) return res.status(401).json({ message: "No autorizado" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ message: "Token inválido" });
  }
};

// Crear factura
router.post("/", async (req, res) => {
  try {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ message: "No autorizado" });

    // Decodifica el token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Busca el usuario que creó la factura
    const user = await User.findById(decoded.id);
    if (!user)
      return res.status(404).json({ message: "Usuario no encontrado" });

    // Extrae datos del body
    const { toUserEmail, price, service, comments, date } = req.body;

    if (!toUserEmail || !price || !service) {
      return res.status(400).json({ message: "Faltan datos requeridos" });
    }

    // 🔹 Verificar que el usuario destinatario exista
    const recipient = await User.findOne({ email: toUserEmail });
    if (!recipient) {
      return res
        .status(400)
        .json({ message: "El correo destinatario no existe" });
    }

    // Crear factura
    const invoice = new Invoice({
      toUserEmail,
      price,
      service,
      comments,
      date,
      createdBy: user.name,
      createdByEmail: user.email,
    });

    await invoice.save();
    res.status(201).json(invoice);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Error al crear factura" });
  }
});
// Obtener facturas pendientes para el usuario logueado
router.get("/pending", async (req, res) => {
  try {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ message: "No autorizado" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userEmail = decoded.email;

    const invoices = await Invoice.find({ toUserEmail: userEmail });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ message: "Error al obtener facturas" });
  }
});

// Obtener facturas enviadas por el usuario logueado
router.get("/sent", async (req, res) => {
  try {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ message: "No autorizado" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userEmail = decoded.email;

    const invoices = await Invoice.find({ createdByEmail: userEmail });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ message: "Error al obtener facturas enviadas" });
  }
});
// Obtener facturas pendientes para el usuario logueado
router.get("/pending", async (req, res) => {
  try {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ message: "No autorizado" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userEmail = decoded.email;

    const invoices = await Invoice.find({
      toUserEmail: userEmail,
      status: "pendiente",
    });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ message: "Error al obtener facturas pendientes" });
  }
});
// Actualizar estado de una factura
router.put("/:id/status", async (req, res) => {
  try {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ message: "No autorizado" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userEmail = decoded.email;

    const { status } = req.body;
    if (!status || !["pendiente", "pagada", "cancelada"].includes(status)) {
      return res.status(400).json({ message: "Estado inválido" });
    }

    // Buscar factura
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: "Factura no encontrada" });
    }

    // ✅ Solo puede cambiar estado quien la recibió
    if (invoice.toUserEmail !== userEmail) {
      return res
        .status(403)
        .json({ message: "No autorizado para actualizar esta factura" });
    }

    invoice.status = status;
    await invoice.save();

    res.json({ message: "Estado actualizado correctamente", invoice });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al actualizar estado" });
  }
});

module.exports = router;
