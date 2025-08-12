import express from "express";

import { callbackPayout, payOut } from "../controller/payment.js";





const paymentRoutes = express.Router();

paymentRoutes.post("/payOut", payOut);

paymentRoutes.get("/payOut/callback", callbackPayout);

export default paymentRoutes;