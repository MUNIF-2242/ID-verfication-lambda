const AWS = require("aws-sdk");
require("dotenv").config(); // Ensure environment variables are loaded

const rekognition = new AWS.Rekognition();

exports.handler = async (event) => {
  const response = {
    statusCode: 500,
    body: JSON.stringify({ message: "An error occurred." }),
  };

  try {
    const body = JSON.parse(event.body);
    const { selfieUrl, nidUrl } = body;

    if (!selfieUrl || !nidUrl) {
      response.statusCode = 400;
      response.body = JSON.stringify({
        message: "Both image URLs are required.",
      });
      return response;
    }

    const params = {
      SourceImage: {
        S3Object: {
          Bucket: process.env.YOUR_S3_BUCKET_NAME,
          Name: selfieUrl.split("/").pop(),
        },
      },
      TargetImage: {
        S3Object: {
          Bucket: process.env.YOUR_S3_BUCKET_NAME,
          Name: nidUrl.split("/").pop(),
        },
      },
      SimilarityThreshold: 90, // Adjust as needed
    };

    const result = await rekognition.compareFaces(params).promise();
    const faceMatches = result.FaceMatches;
    const matched = faceMatches.some((faceMatch) => faceMatch.Similarity >= 90); // Adjust threshold as needed

    response.statusCode = 200;
    response.body = JSON.stringify({
      matched,
      similarityScores: faceMatches.map((faceMatch) => faceMatch.Similarity),
      message: matched ? "Faces matched." : "Faces did not match.",
    });
  } catch (error) {
    console.error("Error:", error);
    response.statusCode = 500;
    response.body = JSON.stringify({
      message: "An error occurred while comparing the images.",
    });
  }

  return response;
};
