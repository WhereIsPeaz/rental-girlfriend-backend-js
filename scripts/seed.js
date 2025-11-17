const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

// Load env
dotenv.config({ path: path.join(__dirname, "../config/.env") });

// Import models
const User = require("../models/User");
const Service = require("../models/Service");
const Review = require("../models/Review");
const Booking = require("../models/Booking");
const Transaction = require("../models/Transaction");
const Payment = require("../models/Payment");
const Withdrawal = require("../models/Withdrawal");

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

// Sample data
const sampleUsers = [
  {
    _id: "1",
    email: "provider1@example.com",
    username: "jenny_cute",
    password: "123456",
    firstName: "เจนนี่",
    lastName: "สวยงาม",
    birthdate: "1998-05-15",
    idCard: "1-1234-56789-12-3",
    phone: "089-123-4567",
    gender: "หญิง",
    interestedGender: "ชาย",
    type: "provider",
    img: "/img/provider1.png",
    joined: "2024",
    verified: true,
  },
  {
    _id: "2",
    email: "provider2@example.com",
    username: "bow_lovely",
    password: "123456",
    firstName: "โบว์",
    lastName: "น่ารัก",
    birthdate: "1999-08-22",
    idCard: "1-2345-67890-23-4",
    phone: "089-234-5678",
    gender: "หญิง",
    interestedGender: "ชาย",
    type: "provider",
    img: "/img/provider2.png",
    joined: "2024",
    verified: true,
  },
  {
    _id: "3",
    email: "provider3@example.com",
    username: "mint_sweet",
    password: "123456",
    firstName: "มิ้นต์",
    lastName: "หวานใจ",
    birthdate: "1997-12-10",
    idCard: "1-3456-78901-34-5",
    phone: "089-345-6789",
    gender: "หญิง",
    interestedGender: "ชาย",
    type: "provider",
    img: "/img/provider3.png",
    joined: "2023",
    verified: true,
  },
  {
    _id: "4",
    email: "customer1@example.com",
    username: "somchai_user",
    password: "123456",
    firstName: "สมชาย",
    lastName: "ใจดี",
    birthdate: "1995-03-20",
    idCard: "1-4567-89012-45-6",
    phone: "089-456-7890",
    gender: "ชาย",
    interestedGender: "หญิง",
    type: "customer",
    img: "/img/p1.jpg",
    joined: "2024",
    verified: true,
  },
];

const sampleServices = [
  {
    _id: "1",
    providerId: "1",
    name: "เดทดูหนังโรแมนติก",
    description:
      "เจนค่ะ เจนค่ะ หนูชื่อเจนมากับบูมแล้วก็มากับโบว์ โบว์ค่ะ โบว์ค่ะ หนูชื่อโบว์มากับบูม แล้วก็มากับเจน นุ่มค่ะ นุ่มค่ะ...",
    categories: ["เดท/คู่เดท", "ดูหนัง"],
    priceHour: 500,
    priceDay: 3000,
    images: ["/img/provider1.png"],
    rating: 4.8,
    reviewCount: 127,
    bookingCount: 145,
    active: true,
    createdAt: "2024-01-15T10:00:00Z",
  },
  {
    _id: "2",
    providerId: "2",
    name: "ช้อปปิ้งและทานอาหาร",
    description:
      "โบว์พร้อมไปช้อปปิ้งและหาอะไรอร่อยๆ กินกันค่ะ รับรองสนุกแน่นอน มีประสบการณ์ช้อปปิ้งมากมาย",
    categories: ["ช้อปปิ้ง", "ทานอาหาร", "เพื่อนร่วมกิจกรรม"],
    priceHour: 450,
    priceDay: 2800,
    images: ["/img/provider2.png"],
    rating: 4.9,
    reviewCount: 89,
    bookingCount: 112,
    active: true,
    createdAt: "2024-02-01T14:30:00Z",
  },
  {
    _id: "3",
    providerId: "3",
    name: "ถ่ายรูปและเดินเล่น",
    description:
      "มิ้นต์ชอบถ่ายรูปและเดินเล่นในสถานที่สวยๆ ค่ะ มาสร้างความทรงจำดีๆ ไปด้วยกันนะคะ",
    categories: ["ถ่ายรูป", "เดินเล่น", "ท่องเที่ยว"],
    priceHour: 550,
    priceDay: 3200,
    images: ["/img/provider3.png"],
    rating: 4.7,
    reviewCount: 156,
    bookingCount: 203,
    active: true,
    createdAt: "2024-01-20T09:15:00Z",
  },
  {
    _id: "4",
    providerId: "1",
    name: "งานสังคมและปาร์ตี้",
    description:
      "เหมาะสำหรับงานสังคม งานปาร์ตี้ หรือกิจกรรมต่างๆ ที่ต้องการเพื่อนร่วมงาน",
    categories: ["งานสังคม", "เพื่อนร่วมกิจกรรม"],
    priceHour: 600,
    priceDay: 3500,
    images: ["/img/provider1.png"],
    rating: 4.6,
    reviewCount: 78,
    bookingCount: 95,
    active: true,
    createdAt: "2024-02-10T16:45:00Z",
  },
  {
    _id: "5",
    providerId: "2",
    name: "คอนเสิร์ตและกิจกรรมกีฬา",
    description: "ชอบดูคอนเสิร์ตและกิจกรรมกีฬาต่างๆ มาสนุกไปด้วยกันค่ะ",
    categories: ["คอนเสิร์ต", "กีฬา", "เพื่อนร่วมกิจกรรม"],
    priceHour: 480,
    priceDay: 2900,
    images: ["/img/provider2.png"],
    rating: 4.8,
    reviewCount: 134,
    bookingCount: 167,
    active: true,
    createdAt: "2024-01-25T11:20:00Z",
  },
];

const sampleReviews = [
  {
    _id: "1",
    serviceId: "1",
    customerId: "4",
    rating: 5,
    comment: "บริการดีมาก เจนน่ารักและเป็นกันเองมาก",
    bookingId: "3",
    createdAt: "2024-02-15T10:30:00Z",
  },
  {
    _id: "2",
    serviceId: "2",
    customerId: "4",
    rating: 5,
    comment: "โบว์ช่วยเลือกของได้ดีมาก แนะนำร้านอาหารอร่อยด้วย",
    bookingId: "2",
    createdAt: "2024-02-20T15:45:00Z",
  },
];

const sampleBookings = [
  {
    _id: "1",
    customerId: "4",
    providerId: "1",
    serviceId: "1",
    serviceName: "เดทดูหนังโรแมนติก",
    date: "2025-12-25",
    startTime: "19:00",
    endTime: "22:00",
    totalHours: 3,
    totalAmount: 1500,
    depositAmount: 750,
    status: "confirmed",
    paymentStatus: "paid",
    specialRequests: "อยากดูหนังแอคชั่น ขอหนังที่มีซับไตเติลภาษาไทย",
    createdAt: "2024-12-20T10:00:00Z",
    updatedAt: "2024-12-20T10:00:00Z",
  },
  {
    _id: "2",
    customerId: "4",
    providerId: "2",
    serviceId: "2",
    serviceName: "ช้อปปิ้งและทานอาหาร",
    date: "2025-12-30",
    startTime: "14:00",
    endTime: "18:00",
    totalHours: 4,
    totalAmount: 1800,
    depositAmount: 900,
    status: "pending",
    paymentStatus: "paid",
    specialRequests: "อยากไปห้างสยามพารากอน และทานอาหารญี่ปุ่น",
    createdAt: "2024-12-22T15:30:00Z",
    updatedAt: "2024-12-22T15:30:00Z",
  },
  {
    _id: "3",
    customerId: "4",
    providerId: "3",
    serviceId: "3",
    serviceName: "ถ่ายรูปและเดินเล่น",
    date: "2024-12-15",
    startTime: "10:00",
    endTime: "16:00",
    totalHours: 6,
    totalAmount: 3300,
    depositAmount: 1650,
    status: "completed",
    paymentStatus: "paid",
    specialRequests: "อยากถ่ายรูปที่สวนลุมพินี และเดินเล่นที่ตลาดนัดจตุจักร",
    createdAt: "2024-12-10T09:15:00Z",
    updatedAt: "2024-12-15T16:00:00Z",
  },
];

const sampleTransactions = [
  {
    _id: "trans-1",
    customerId: "4",
    amount: 5000,
    currency: "THB",
    method: "credit_card",
    type: "topup",
    status: "completed",
    note: "เติมเงินเข้าบัญชี",
    createdAt: "2024-12-10T08:00:00Z",
  },
  {
    _id: "trans-2",
    customerId: "4",
    amount: 3300,
    currency: "THB",
    method: "wallet",
    type: "payment",
    status: "completed",
    note: "ชำระค่าบริการ - ถ่ายรูปและเดินเล่น",
    createdAt: "2024-12-15T16:00:00Z",
  },
  {
    _id: "trans-3",
    customerId: "3",
    amount: 2970,
    currency: "THB",
    method: "transfer",
    type: "topup",
    status: "completed",
    note: "รายได้จากการให้บริการ - ถ่ายรูปและเดินเล่น",
    createdAt: "2024-12-15T16:00:00Z",
  },
  {
    _id: "trans-4",
    customerId: "1",
    amount: 2500,
    currency: "THB",
    method: "transfer",
    type: "topup",
    status: "completed",
    note: "รายได้จากการให้บริการ",
    createdAt: "2024-12-01T10:00:00Z",
  },
  {
    _id: "trans-5",
    customerId: "2",
    amount: 1800,
    currency: "THB",
    method: "transfer",
    type: "topup",
    status: "completed",
    note: "รายได้จากการให้บริการ",
    createdAt: "2024-12-05T14:00:00Z",
  },
];

const samplePayments = [
  {
    _id: "payment-1",
    bookingId: "3",
    customerId: "4",
    providerId: "3",
    amount: 3300,
    paymentMethod: "credit_card",
    status: "completed",
    transactionId: "trans-2",
    completedAt: "2024-12-15T16:00:00Z",
    createdAt: "2024-12-10T09:15:00Z",
  },
  {
    _id: "payment-2",
    bookingId: "1",
    customerId: "4",
    providerId: "1",
    amount: 1500,
    paymentMethod: "promptpay",
    status: "completed",
    completedAt: "2024-12-20T10:00:00Z",
    createdAt: "2024-12-20T10:00:00Z",
  },
];

const sampleWithdrawals = [
  {
    _id: "withdrawal-1",
    userId: "3",
    amount: 2000,
    bankName: "ธนาคารกสิกรไทย",
    accountNumber: "123-4-56789-0",
    accountName: "มิ้นต์ หวานใจ",
    status: "completed",
    requestedAt: "2024-12-16T10:00:00Z",
    completedAt: "2024-12-17T14:00:00Z",
    createdAt: "2024-12-16T10:00:00Z",
  },
];

// Seed function
const seedDatabase = async () => {
  try {
    await connectDB();

    console.log("Clearing existing data...");
    await User.deleteMany({});
    await Service.deleteMany({});
    await Review.deleteMany({});
    await Booking.deleteMany({});
    await Transaction.deleteMany({});
    await Payment.deleteMany({});
    await Withdrawal.deleteMany({});

    console.log("Seeding users...");
    await User.insertMany(sampleUsers);

    console.log("Seeding services...");
    await Service.insertMany(sampleServices);

    console.log("Seeding reviews...");
    await Review.insertMany(sampleReviews);

    console.log("Seeding bookings...");
    await Booking.insertMany(sampleBookings);

    console.log("Seeding transactions...");
    await Transaction.insertMany(sampleTransactions);

    console.log("Seeding payments...");
    await Payment.insertMany(samplePayments);

    console.log("Seeding withdrawals...");
    await Withdrawal.insertMany(sampleWithdrawals);

    console.log("✅ Database seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
