const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const cookieParser = require('cookie-parser');

const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUI = require('swagger-ui-express');

// load env
dotenv.config({path: './config/.env'});

// connect to DB
connectDB();

// Import all routes
const auth = require('./routes/auth');
const services = require('./routes/services');
const bookings = require('./routes/bookings');
const reviews = require('./routes/reviews');
const users = require('./routes/users');
// const books = require('./routes/books');

const app = express();
const api = express(); // Sub app that holds all API routes

// Body express
api.set('query parser', 'extended');


// Middlewares
api.use(express.json());
api.use(cookieParser());

// Example: All routers go here (MUST USE "api" ROUTER)
api.use("/auth", auth);
api.use("/services", services);
api.use("/bookings", bookings);
api.use("/reviews", reviews);
api.use("/users", users);
// api.use("/books", require("./routes/books"));

// Mount app router to api router
app.use("/api/v1", api);

const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'API Library',
            version: '1.0.0',
            description: 'Rental Girlfriend Backend App V2'
        },
        servers: [
            {
                url: 'http://localhost:5003/api/v1'
            }
        ],
    },
    apis: ['./routes/*.js'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerDocs));

const PORT = process.env.PORT || 5003;
const server = app.listen(PORT, console.log('Server running in', process.env.NODE_ENV, 'mode on port', PORT));

process.on('unhandledRejection', (err, promise)=> {
    console.log(`Error: ${err.message}`);
    server.close(() => process.exit(1));
});
