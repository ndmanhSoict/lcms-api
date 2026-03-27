import express, { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import "dotenv/config";

import { healthRouter } from "./routes/health.js";
import { errorHandler } from "./middleware/errorHandler.middleware.js";


const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || "mongodb"
    const conn = await mongoose.connect(mongoURI);
    console.log(`✅ Kết nối MongoDB thành công: ${conn.connection.host}`);
  } catch (error) {
    console.error("❌ Lỗi kết nối MongoDB:", error);
    process.exit(1);
  }
};

app.use("/health", healthRouter);

app.get("/", (req: Request, res: Response) => {
  res.json({ 
    status: "ok", 
    message: "Hệ thống LCMS API đang hoạt động!" 
  });
});

// Handler cho route không tồn tại (404)
app.use((req, res, next) => {
  const error = new Error(`Route ${req.originalUrl} không tìm thấy`);
  (error as any).statusCode = 404;
  next(error);
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Lỗi hệ thống:", err.message);
  res.status(500).json({ status: "error", message: "Đã có lỗi xảy ra từ phía server" });
});

app.use(errorHandler);

app.listen(PORT, async () => {
  await connectDB();
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});
