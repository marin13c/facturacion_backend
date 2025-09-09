require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// Middlewares
app.use(cors());

// Middleware para permitir JSON grande (incluyendo imágenes en base64)
app.use(express.json({ limit: "10mb" })); // acepta hasta 10MB
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Rutas
const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);

const invoiceRoutes = require("./routes/invoices");
app.use("/api/invoices", invoiceRoutes);

// Puerto
const PORT = process.env.PORT || 4000;

// Conexión Mongo y servidor
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ MongoDB conectado");
    app.listen(PORT, () =>
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`)
    );
  })
  .catch((err) => {
    console.error("❌ Error conectando a Mongo:", err);
  });
