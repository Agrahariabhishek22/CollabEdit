import { SalesAnalytics } from "../models/salesAnalytics.js";
import { Order } from "../models/order.js";

// Update sales analytics when an order is placed or modified
export const updateSalesAnalytics = async (shopId, products, profit, paymentMethod) => {
    try {
        console.log("update analytics called");
        // console.log(shopId)
        // console.log(products)
        // console.log(profit)
        // console.log(paymentMethod)
        const today = new Date().toISOString().split("T")[0]; // Get today's date

        const totalQuantitySold = products.reduce((sum, product) => sum + product.quantity, 0);

        // Find existing analytics record
        let analytics = await SalesAnalytics.findOne({ shopId });

        if (!analytics) {
            // If analytics document doesn't exist, create it
            analytics = await SalesAnalytics.create({
                shopId,
                totalSuccessfulOrders: 1,
                totalQuantitySold,
                totalProfit: profit,
                revenueBreakdown: {
                    onlinePayments: paymentMethod === "online" ? profit : 0,
                    cashPayments: paymentMethod === "cash" ? profit : 0
                },
                dailyStats: [{ date: today, quantitySold: totalQuantitySold, profit }]
            });
        } else {
            // Update main stats
            analytics.totalSuccessfulOrders += 1;
            analytics.totalQuantitySold += totalQuantitySold;
            analytics.totalProfit += profit;

            // Update revenue breakdown
            if (paymentMethod === "online") {
                analytics.revenueBreakdown.onlinePayments += profit;
            } else if (paymentMethod === "cash") {
                analytics.revenueBreakdown.cashPayments += profit;
            }

            // Find if today's entry exists in dailyStats
            const existingEntry = analytics.dailyStats.find(stat =>
                stat.date.toISOString().split("T")[0] === today
            );

            if (existingEntry) {
                // If today's entry exists, update it
                existingEntry.quantitySold += totalQuantitySold;
                existingEntry.profit += profit;
            } else {
                // If today's entry doesn't exist, push a new entry
                analytics.dailyStats.push({ date: today, quantitySold: totalQuantitySold, profit });
            }

            // Save updated analytics
            await analytics.save();
        }

    } catch (error) {
        console.error("Error updating sales analytics:", error);
    }
};



// Get sales analytics
export const getSalesAnalytics = async (req, res, next) => {
    try {
        const { shopId } = req.params;
        const { startDate, endDate } = req.query; // Optional date range filter

        let filter = { shopId };

        if (startDate && endDate) {
            filter["dailyStats.date"] = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        const analytics = await SalesAnalytics.findOne(filter);

        res.status(200).json({ success: true, salesAnalytics: analytics || {} });
    } catch (error) {
        next(error);
    }
};
