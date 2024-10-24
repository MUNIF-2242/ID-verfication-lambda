const AWS = require("aws-sdk");
const { Buffer } = require("buffer");
require("dotenv").config(); // Ensure environment variables are loaded

const s3 = new AWS.S3();

exports.handler = async (event) => {
  const response = {
    statusCode: 500,
    body: JSON.stringify({ message: "An error occurred." }),
  };

  try {
    const body = JSON.parse(event.body);
    const { image } = body;

    if (!image) {
      response.statusCode = 400;
      response.body = JSON.stringify({ message: "No image data provided." });
      return response;
    }

    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    const fileName = `birth.jpg`;
    const params = {
      Bucket: process.env.YOUR_S3_BUCKET_NAME,
      Key: fileName,
      Body: buffer,
      ContentType: "image/jpg",
    };

    const s3Data = await s3.upload(params).promise();
    const imageUrl = s3Data.Location;

    response.statusCode = 200;
    response.body = JSON.stringify({
      imageUrl,
      fileName,
    });
  } catch (error) {
    console.error("Error:", error);
    response.statusCode = 500;
    response.body = JSON.stringify({
      message: "An error occurred while uploading the image.",
    });
  }

  return response;
};
