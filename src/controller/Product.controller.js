import Product from "../models/Product.model.js";
import mongoose from "mongoose";
import Websitelist from "../models/Website.model.js"; // Import the Websitelist model
export const createProduct = async (req, res) => {
  try {
    console.log("Incoming request body:", req.body);
    console.log("Uploaded files:", req.files);
    console.log("User info:", req.user);

    const {
      referenceWebsite,
      productName,
      discount,
      price,
      actualPrice,
      category,
      description,
      size
    } = req.body;

    let imageArray = [];

    if (req.file) {
      imageArray = [req.file.path];
    } else if (req.files) {
      imageArray = req.files.map(file => file.path);
    }
    const productSize = size || "M";

    console.log("Processed images:", imageArray);
    console.log("Product size:", productSize);
    console.log("Price:", price, "Actual Price:", actualPrice);

    if (actualPrice < 0 || actualPrice > price) {
      console.warn("Invalid actualPrice detected");
      return res.status(400).json({
        message: "Invalid actualPrice. It must be a positive value and less than or equal to price.",
      });
    }

    const product = new Product({
      referenceWebsite,
      productName,
      images: imageArray,
      price: Number(price),
      actualPrice: Number(actualPrice),
      category,
      description,
      size: productSize,
      discount: Number(discount),
      addedBy: req.user?.id?.toString(),
    });

    console.log("Saving product to database:", product);

    await product.save();

    console.log("Product saved successfully");

    res.status(200).json({ message: "Product added successfully", product });
  } catch (error) {
    console.error("Error in createProduct:", error);
    res.status(500).json({ message: "Failed to add product", error: error.message });
  }
};



export const createMultipleProducts = async (req, res) => {
  try {
    const { products } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: "Invalid input. Please provide an array of products." });
    }
    const formattedProducts = products.map(product => ({
      referenceWebsite: "6788b0054c4a217090bf6636",
      productName: product.productName,
      images: typeof product.images === "string" ? [product.images] : [],
      price: product.price,
      actualPrice: product.actualPrice,
      category: product.category,
      description: product.description,
      size: product.size || "M", // Default size is "M" if not provided
      discount: product.discount,
      addedBy: "679c5cc89e0012636ffef9ed"
    }));
    const result = await Product.insertMany(formattedProducts);
    res.status(200).json({
      message: `${result.length} products added successfully`,
      products: result,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to add products", error: error.message });
  }
};

export const getProducts = async (req, res) => {
  try {
    const {
      referenceWebsite,
      category,
      minPrice = 0,
      maxPrice = 1000000,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 100,
      newArrival, // ✅ added
    } = req.query;


    if (!referenceWebsite) {
      return res.status(400).json({ message: "Missing referenceWebsite" });
    }

    const pipeline = [];

    // Match the website
    pipeline.push({
      $match: {
        referenceWebsite: new mongoose.Types.ObjectId(referenceWebsite),
      },
    });

    // Lookup to join category info
    pipeline.push({
      $lookup: {
        from: "productcategories",
        localField: "category",
        foreignField: "_id",
        as: "category",
      },
    });

    // Flatten the joined category array
    pipeline.push({ $unwind: "$category" });

    // Match by category name (case-insensitive)
    if (category) {
      pipeline.push({
        $match: { 'category._id': new mongoose.Types.ObjectId(category) },
      });
    }

    // Filter by price range
    pipeline.push({
      $match: {
        price: {
          $gte: parseFloat(minPrice),
          $lte: parseFloat(maxPrice),
        },
      },
    });

    // ✅ Filter by new arrivals (last 15 days)
    if (newArrival === "true") {
      const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
      pipeline.push({
        $match: {
          createdAt: { $gte: fifteenDaysAgo },
        },
      });
    }

    // Sorting
    pipeline.push({
      $sort: {
        [sortBy]: sortOrder === "asc" ? 1 : -1,
      },
    });

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: parseInt(limit) });

    // Execute aggregation for products
    const products = await Product.aggregate(pipeline);
    console.log(products);

    // Count total documents (excluding pagination stages)
    const countPipeline = pipeline.filter(
      (stage) => !stage.$skip && !stage.$limit && !stage.$sort
    );
    countPipeline.push({ $count: "total" });

    const countResult = await Product.aggregate(countPipeline);
    const totalDocuments = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalDocuments / limit);

    return res.status(200).json({
      message: "Products retrieved successfully",
      products,
      pagination: {
        totalDocuments,
        currentPage: parseInt(page),
        pageSize: parseInt(limit),
        totalPages,
      },
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return res.status(500).json({
      message: "Failed to retrieve products",
      error: error.message,
    });
  }
};


// export const getProducts = async (req, res) => {
//     try {
//         const {
//             referenceWebsite,
//             search,
//             category, // Specific category filter
//             minPrice,
//             maxPrice,
//             sortBy = 'createdAt', // Sorting field
//             sortOrder = 'desc',   // Sorting order
//             page = 1,
//             limit = 10,
//         } = req.query;

//         const user = req.user?.id?.toString();
//         const role = req.user?.role;

//         if (!referenceWebsite) {
//             return res.status(400).json({ message: "Reference website is required" });
//         }

//         const pageNumber = parseInt(page, 10) || 1;
//         const pageSize = parseInt(limit, 10) || 10;

//         const website = await Websitelist.findById(referenceWebsite);
//         if (!website) {
//             return res.status(404).json({ message: "Reference website not found" });
//         }

//         if (website?.categories.length === 0) {
//             return res.status(200).json({
//                 products: [],
//                 pagination: {
//                     totalDocuments: 0,
//                     currentPage: pageNumber,
//                     pageSize,
//                     totalPages: 0,
//                 },
//             });
//         }

//         const matchStage = {
//             category: { $in: website.categories }, // Only products in website's categories
//         };

//         if (role && role !== "admin") matchStage.addedBy = user;

//         if (category) {
//             matchStage.category = new mongoose.Types.ObjectId(category);
//         }

//         if (search) {
//             matchStage.$or = [
//                 { productName: { $regex: search, $options: 'i' } },
//                 { description: { $regex: search, $options: 'i' } },
//             ];
//         }

//         if (minPrice || maxPrice) {
//             matchStage.actualPrice = {};
//             if (minPrice) matchStage.actualPrice.$gte = parseFloat(minPrice);
//             if (maxPrice) matchStage.actualPrice.$lte = parseFloat(maxPrice);
//         }

//         const pipeline = [
//             { $match: matchStage },
//             {
//                 $lookup: {
//                     from: 'productcategories', // Name of the categories collection
//                     localField: 'category',
//                     foreignField: '_id',
//                     as: 'category',
//                 },
//             },
//             {
//                 $unwind: {
//                     path: '$category',
//                     preserveNullAndEmptyArrays: true,
//                 },
//             },
//             {
//                 $addFields: {
//                     category: {
//                         _id: '$category._id',
//                         name: '$category.name',
//                     },
//                 },
//             },
//             {
//                 $sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 },
//             },
//             {
//                 $facet: {
//                     metadata: [
//                         { $count: 'totalDocuments' },
//                         {
//                             $addFields: {
//                                 currentPage: pageNumber,
//                                 pageSize,
//                                 totalPages: { $ceil: { $divide: ['$totalDocuments', pageSize] } },
//                             },
//                         },
//                     ],
//                     products: [
//                         { $skip: (pageNumber - 1) * pageSize },
//                         { $limit: pageSize },
//                     ],
//                 },
//             },
//         ];

//         // Execute the aggregation pipeline
//         const results = await Product.aggregate(pipeline);

//         const metadata = results[0]?.metadata[0] || {
//             totalDocuments: 0,
//             currentPage: pageNumber,
//             pageSize,
//             totalPages: 0,
//         };
//         const products = results[0]?.products || [];

//         // Return the response
//         res.status(200).json({
//             products,
//             pagination: metadata,
//         });
//     } catch (error) {
//         console.error('Error in getProducts:', error.message);
//         res.status(500).json({ message: 'Failed to retrieve products', error: error.message });
//     }
// };

export const getProductDetail = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.status(200).json({ message: "Product retrieved successfully", product });
  } catch (error) {
    res.status(500).json({ message: "Failed to retrieve product", error: error.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { productName, price, actualPrice, discount, category, description, size } = req.body;
    let imageArray = [];

    if (req.file) {
      imageArray = [req.file.path];
    } else if (req.files) {
      imageArray = req.files.map(file => file.path);
    }
    const productSize = size || "M";
    if (actualPrice < 0 || actualPrice > price) {
      return res.status(400).json({
        message: "Invalid actualPrice. It must be a positive value and less than or equal to price.",
      });
    }
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      {
        productName,
        images: imageArray,
        price,
        actualPrice: actualPrice || 0,
        category,
        description,
        size: productSize,
        discount
      },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({ message: "Product updated successfully", updatedProduct });
  } catch (error) {
    res.status(500).json({ message: "Failed to update product", error: error.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({ message: "Product deleted successfully", product });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete product", error: error.message });
  }
};

export const setDealOfTheDay = async (req, res) => {
  try {
    const { productId, status, durationInHours } = req.body;

    const nowUTC = new Date();

    // Convert to IST (UTC + 5:30)
    const ISTOffset = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(nowUTC.getTime() + ISTOffset);

    let endTime = null;
    if (status && durationInHours) {
      const duration = parseFloat(durationInHours);
      if (isNaN(duration)) {
        return res.status(400).json({ message: "Invalid durationInHours" });
      }
      endTime = new Date(nowIST.getTime() + duration * 60 * 60 * 1000);
    }

    const product = await Product.findByIdAndUpdate(
      productId,
      {
        dealOfTheDay: {
          status: status,
          startTime: status ? nowIST : null,
          endTime: status ? endTime : null,
        },
      },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({
      message: `Deal of the Day ${status ? "activated" : "removed"}`,
      product,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update Deal of the Day", error: error.message });
  }
};


export const getDealsOfTheDay = async (req, res) => {
  try {
    const utcNow = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(utcNow.getTime() + istOffset);

    console.log("🕒 Current IST Time:", istTime.toLocaleString());
    console.log("🕒 Current UTC Time:", new Date().toISOString());

    const deals = await Product.find({
      "dealOfTheDay.status": true,
      "dealOfTheDay.startTime": { $lte: istTime },
      "dealOfTheDay.endTime": { $gte: istTime },
    });

    res.status(200).json({
      message: "✅ Active deals fetched successfully",
      deals,
    });
  } catch (error) {
    console.error("❌ Error in getDealsOfTheDay:", error.message);
    res.status(500).json({
      message: "❌ Failed to fetch deals",
      error: error.message,
    });
  }
};
