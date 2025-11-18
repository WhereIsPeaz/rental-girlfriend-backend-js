const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const cookieParser = require("cookie-parser");

const mongoSanitize = require("@exortek/express-mongo-sanitize");
const helmet = require("helmet");
const { xss } = require("express-xss-sanitizer");
const hpp = require("hpp");
const cors = require("cors");

const swaggerJsDoc = require("swagger-jsdoc");
const swaggerUI = require("swagger-ui-express");

// load env
dotenv.config({ path: "./config/.env" });

// connect to DB
connectDB();

// Import all routes
const auth = require("./routes/auth");
const services = require("./routes/services");
const bookings = require("./routes/bookings");
const reviews = require("./routes/reviews");
const users = require("./routes/users");
const chats = require("./routes/chats");
const transactions = require("./routes/transactions");
const payments = require("./routes/payments");
const withdrawals = require("./routes/withdrawals");
// const books = require('./routes/books');

const app = express();
const api = express(); // Sub app that holds all API routes

// Body express
api.set("query parser", "extended");

// Middlewares
// Increase body size limit to 10MB for base64 images
api.use(express.json({ limit: "10mb" }));
api.use(express.urlencoded({ limit: "10mb", extended: true }));
api.use(cookieParser());

// Custom middleware to protect base64 images from mongoSanitize
api.use((req, res, next) => {
  // Store img field temporarily if it exists
  if (req.body && req.body.img && typeof req.body.img === "string") {
    req._protectedImg = req.body.img;
    delete req.body.img;
  }

  // Also protect images array in services
  if (req.body && req.body.images && Array.isArray(req.body.images)) {
    req._protectedImages = req.body.images;
    delete req.body.images;
  }

  next();
});

// Apply mongoSanitize to sanitize other fields
api.use(mongoSanitize());

// Restore protected fields after sanitization
api.use((req, res, next) => {
  if (req._protectedImg) {
    req.body.img = req._protectedImg;
    delete req._protectedImg;
  }

  if (req._protectedImages) {
    req.body.images = req._protectedImages;
    delete req._protectedImages;
  }

  next();
});

api.use(helmet());
api.use(xss());
api.use(hpp());
api.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://rental-girlfriend-fe.vercel.app",
    ],
    credentials: true,
  })
);

// Example: All routers go here (MUST USE "api" ROUTER)
api.use("/auth", auth);
api.use("/services", services);
api.use("/bookings", bookings);
api.use("/reviews", reviews);
api.use("/users", users);
api.use("/chats", chats);
api.use("/transactions", transactions);
api.use("/payments", payments);
api.use("/withdrawals", withdrawals);
// api.use("/books", require("./routes/books"));

// Mount app router to api router
app.use("/api/v1", api);

const swaggerOptions = {
  swaggerDefinition: {
    openapi: "3.0.0",
    info: {
      title: "API Library",
      version: "1.0.0",
      description: "Rental Girlfriend Backend App V2",
    },
    servers: [
      {
        url: "http://" + process.env.SERVER_HOST + "/api/v1",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./routes/*.js"],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use("/api/v1/api-docs", swaggerUI.serve, swaggerUI.setup(swaggerDocs));

const PORT = process.env.PORT || 5003;
const HOST = process.env.HOST || "127.0.0.1";
const server = app.listen(
  PORT,
  HOST,
  console.log(
    "Server running in",
    process.env.NODE_ENV,
    "mode on port",
    PORT,
    "on host",
    HOST
  )
);

process.on("unhandledRejection", (err, promise) => {
  console.log(`Error: ${err.message}`);
  server.close(() => process.exit(1));
});
