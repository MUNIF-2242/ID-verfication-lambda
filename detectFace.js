const AWS = require("aws-sdk");

AWS.config.update({ region: process.env.AWS_REGION });

const rekognition = new AWS.Rekognition();

exports.handler = async (event) => {
  let response;

  try {
    // Parse the incoming event body to get imageUrl
    const { imageUrl } = JSON.parse(event.body);

    if (!imageUrl) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "No image URL provided." }),
      };
    }

    // Extract the bucket name and key from the imageUrl
    const bucketName = process.env.YOUR_S3_BUCKET_NAME;
    const key = imageUrl.split("/").pop(); // Fixing the key extraction

    if (!key) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid image URL provided." }),
      };
    }

    const params = {
      Image: {
        S3Object: {
          Bucket: bucketName,
          Name: key,
        },
      },
      Attributes: ["ALL"], // Return all facial attributes
    };

    // Detect faces using AWS Rekognition
    const rekognitionData = await rekognition.detectFaces(params).promise();

    if (rekognitionData.FaceDetails && rekognitionData.FaceDetails.length > 0) {
      // Face(s) detected
      response = {
        statusCode: 200,
        body: JSON.stringify({
          faceDetected: true,
          message: "Face detected successfully.",
          details: rekognitionData.FaceDetails,
        }),
      };
    } else {
      // No faces detected
      response = {
        statusCode: 200,
        body: JSON.stringify({
          faceDetected: false,
          message: "No face detected in the image.",
        }),
      };
    }
  } catch (error) {
    console.error("Error:", error);
    response = {
      statusCode: 500,
      body: JSON.stringify({
        message: "An error occurred while detecting faces.",
        error: error.message,
      }),
    };
  }

  return response;
};
