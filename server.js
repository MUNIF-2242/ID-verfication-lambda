const express = require("express");
const AWS = require("aws-sdk");
const { Buffer } = require("buffer");
const axios = require("axios");

require("dotenv").config(); // Ensure environment variables are loaded

const app = express();
const port = 3000;

// Configure AWS
AWS.config.update({
  region: "us-east-1",
  accessKeyId: process.env.YOUR_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.YOUR_AWS_SECRET_ACCESS_KEY,
});
const textract = new AWS.Textract();
const s3 = new AWS.S3();
const rekognition = new AWS.Rekognition();

app.use(express.json({ limit: "50mb" }));

app.post("/upload-birth", async (req, res) => {
  const { image } = req.body;

  if (!image) {
    return res.status(400).send("No image data provided.");
  }

  // Extract Base64 data from image string
  const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");

  //const fileName = `image-${Date.now()}.jpg`;
  const fileName = `birth.jpg`;
  const params = {
    Bucket: process.env.YOUR_S3_BUCKET_NAME,
    Key: fileName,
    Body: buffer,
    ContentType: "image/jpg",
  };

  try {
    // Upload image to S3
    const s3Data = await s3.upload(params).promise();
    const imageUrl = s3Data.Location;

    res.json({
      imageUrl,
      fileName,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("An error occurred while uploading the image.");
  }
});

const moment = require("moment"); // Ensure moment is required

app.post("/detect-birthno", async (req, res) => {
  console.log("Endpoint /detect-text was hit.");

  const { fileName } = req.body;

  if (!fileName) {
    return res.status(400).send("No file name provided.");
  }

  const params = {
    Document: {
      S3Object: {
        Bucket: process.env.YOUR_S3_BUCKET_NAME,
        Name: fileName,
      },
    },
  };

  try {
    const textractData = await textract.detectDocumentText(params).promise();
    const jsonData = textractData.Blocks;

    const lineBlocks = jsonData.filter((block) => block.BlockType === "LINE");

    const birthRegNoRegex = /\b\d{17}\b/;
    const birthRegNoLine = lineBlocks.find((block) =>
      birthRegNoRegex.test(block.Text)
    );

    let birthRegistrationNumber = null;
    let firstFourDigits = null;
    let matchingBlocks = null;
    let nextBlock = null;

    if (birthRegNoLine) {
      birthRegistrationNumber = birthRegNoLine.Text.match(birthRegNoRegex)[0];
      firstFourDigits = birthRegistrationNumber.substring(0, 4);

      matchingBlocks = lineBlocks.filter(
        (block) =>
          block.Text.includes(firstFourDigits) &&
          !block.Text.includes(birthRegistrationNumber)
      );
    } else {
      return res
        .status(404)
        .json({ message: "Birth Registration Number not found." });
    }

    const inWordIndex = lineBlocks.findIndex(
      (block) => block.Text && block.Text.includes("In Word:")
    );

    if (inWordIndex !== -1 && inWordIndex < lineBlocks.length - 1) {
      nextBlock = lineBlocks[inWordIndex + 1];
    }

    let dob = matchingBlocks?.[0]?.Text || nextBlock?.Text || "DOB not found";

    // Clean the dob value (remove extra text like 'Date of Birth:')
    dob = dob.replace(/Date of Birth:\s*/i, "").trim();

    // Function to remove ordinal suffixes (st, nd, rd, th)
    const removeOrdinalSuffix = (dateStr) => {
      return dateStr.replace(/\b(\d+)(st|nd|rd|th)\b/gi, "$1");
    };

    // Apply the ordinal removal function to the dob value
    dob = removeOrdinalSuffix(dob);

    // Convert dob to YYYY-MM-DD format using moment with custom formats
    const parsedDate = moment(
      dob,
      [
        "DD-MM-YYYY", // e.g., "22-09-2001"
        "D MMM, YYYY", // e.g., "17 Mar, 2004" (after removing ordinal suffix)
        "DD MMMM YYYY", // e.g., "14 SEPTEMBER 2002"
        "D MMM YYYY", // e.g., "1st Jan 2000" (after removing ordinal suffix)
        "YYYY-MM-DD", // ISO format if available
      ],
      true
    ); // true for strict parsing

    if (!parsedDate.isValid()) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    // Format dob to YYYY-MM-DD
    const dateOfBirth = parsedDate.format("YYYY-MM-DD");

    // Extract the year part (YYYY) from the parsed date
    const dobYear = parsedDate.year().toString();

    // Compare the extracted dobYear with the first four digits of birthRegistrationNumber
    if (dobYear === firstFourDigits) {
      // If the year matches the first four digits, send success response
      return res.json({
        success: true,
        message: "Date of birth year matches the birth registration number.",
        data: {
          birthRegistrationNumber,
          dateOfBirth, // The formatted date
        },
      });
    } else {
      // If the year does not match, return an error response
      return res.status(400).json({
        success: false,
        message:
          "Date of birth year does not match the birth registration number.",
        data: {
          birthRegistrationNumber,
          dateOfBirth, // The formatted date
        },
      });
    }
  } catch (error) {
    console.error("Error occurred while detecting text:", error);
    res.status(500).send("An error occurred while detecting text.");
  }
});

app.post("/detect-text", async (req, res) => {
  console.log("Endpoint /detect-text was hit.");

  const { fileName } = req.body;

  if (!fileName) {
    console.log("No fileName provided.");
    return res.status(400).send("No file name provided.");
  }

  const params = {
    Document: {
      S3Object: {
        Bucket: process.env.YOUR_S3_BUCKET_NAME,
        Name: fileName,
      },
    },
  };

  try {
    console.log("Calling Textract to detect text...");

    const textractData = await textract.detectDocumentText(params).promise();
    const jsonData = textractData.Blocks;

    // Filter blocks to get lines of text
    const lineBlocks = jsonData.filter((block) => block.BlockType === "LINE");

    // console.log("lineBlocks");
    // console.log(lineBlocks);

    let nameBlock = null;
    let dobBlock = null;
    let nidBlock = null;
    let nextBlock = null;
    let success = false;
    let name = null,
      dob = null,
      nid = null;

    // Iterate through the line blocks to find "Name", "Date of Birth", and the last line with NID (numbers)
    lineBlocks.forEach((block, index) => {
      const blockText = block.Text;

      // Check for "Name"
      if (blockText.includes("Name")) {
        if (blockText.trim() === "Name") {
          // If the block contains only "Name", fetch the next block
          nextBlock = lineBlocks[index + 1];
          if (nextBlock) {
            nameBlock = nextBlock;
            name = nextBlock.Text;
          }
        } else {
          // If the block contains "Name" with other characters, use this block
          nameBlock = block;
          name = blockText.replace(/Name[:\s]*/i, "").trim();
        }
      }

      // Check for "Date of Birth"
      if (blockText.includes("Date of Birth")) {
        if (blockText.trim() === "Date of Birth") {
          // If the block contains only "Date of Birth", fetch the next block
          nextBlock = lineBlocks[index + 1];
          if (nextBlock) {
            dobBlock = nextBlock;
            dob = nextBlock.Text;
          }
        } else {
          // If the block contains "Date of Birth" with other characters, use this block
          dobBlock = block;
          dob = blockText.replace(/Date of Birth[:\s]*/i, "").trim();
        }
      }

      // Check for NID (the block should contain at least one number)
      if (/\d/.test(blockText)) {
        nidBlock = block;
        nid = blockText.replace(/\D/g, ""); // Remove all non-numeric characters
      }
    });

    if (nameBlock || dobBlock || nidBlock) {
      success = true;
      // Log the detected fields
      console.log("Detected Name block: ", name);
      console.log("Detected Date of Birth block: ", dob);
      console.log("Detected NID block (numbers only): ", nid);
    }

    if (!success) {
      console.log("Failed to detect Name, Date of Birth, or NID fields.");
    }

    // Return the status and detected values
    res.json({
      status: success ? "success" : "fail",
      nidData: {
        dob,
        name,
        nid,
      },
    });
  } catch (error) {
    console.error("Error occurred while detecting text:", error);
    res.status(500).json({
      status: "error",
      message: "An error occurred while detecting text.",
    });
  }
});

app.post("/upload-selfie", async (req, res) => {
  const { image } = req.body;

  if (!image) {
    return res.status(400).send("No image data provided.");
  }

  // Extract Base64 data from image string
  const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");

  //const fileName = `image-${Date.now()}.jpg`;
  const fileName = `selfie.jpg`;
  const params = {
    Bucket: process.env.YOUR_S3_BUCKET_NAME,
    Key: fileName,
    Body: buffer,
    ContentType: "image/jpg",
  };

  try {
    // Upload image to S3
    const s3Data = await s3.upload(params).promise();
    const imageUrl = s3Data.Location;

    res.json({
      imageUrl,
      fileName,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("An error occurred while uploading the image.");
  }
});

app.post("/upload-nid", async (req, res) => {
  const { image } = req.body;

  if (!image) {
    return res.status(400).send("No image data provided.");
  }

  // Extract Base64 data from image string
  const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");

  //const fileName = `image-${Date.now()}.jpg`;
  const fileName = `nid.jpg`;
  const params = {
    Bucket: process.env.YOUR_S3_BUCKET_NAME,
    Key: fileName,
    Body: buffer,
    ContentType: "image/jpg",
  };

  try {
    // Upload image to S3
    const s3Data = await s3.upload(params).promise();
    const imageUrl = s3Data.Location;

    res.json({
      imageUrl,
      fileName,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("An error occurred while uploading the image.");
  }
});

app.post("/compare-face", async (req, res) => {
  const { selfieUrl, nidUrl } = req.body;

  if (!selfieUrl || !nidUrl) {
    return res.status(400).send("Both image URLs are required.");
  }

  // Prepare parameters for Rekognition
  const params = {
    SourceImage: {
      S3Object: {
        Bucket: process.env.YOUR_S3_BUCKET_NAME,
        Name: selfieUrl.split("/").pop(), // Extract file name from URL
      },
    },
    TargetImage: {
      S3Object: {
        Bucket: process.env.YOUR_S3_BUCKET_NAME,
        Name: nidUrl.split("/").pop(), // Extract file name from URL
      },
    },
    SimilarityThreshold: 90, // Adjust as needed
  };

  try {
    // Call Rekognition to compare faces
    //const result = await rekognition.compareFaces(params).promise();
    //res.json(result);

    const result = await rekognition.compareFaces(params).promise();
    const faceMatches = result.FaceMatches;
    const matched = faceMatches.some((faceMatch) => faceMatch.Similarity >= 90); // Adjust threshold as needed

    res.json({
      matched,
      similarityScores: faceMatches.map((faceMatch) => faceMatch.Similarity),
      message: matched ? "Faces matched." : "Faces did not match.",
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("An error occurred while comparing the images.");
  }
});

app.post("/detect-face", async (req, res) => {
  const { imageUrl } = req.body;

  if (!imageUrl) {
    return res.status(400).send("No image URL provided.");
  }

  // Extract the bucket name and key from the imageUrl
  const bucketName = process.env.YOUR_S3_BUCKET_NAME;

  const key = imageUrl.split("/").pop(); // Fixing the key extraction

  if (!key) {
    return res.status(400).send("Invalid image URL provided.");
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

  try {
    // Detect faces using AWS Rekognition
    const rekognitionData = await rekognition.detectFaces(params).promise();

    if (rekognitionData.FaceDetails && rekognitionData.FaceDetails.length > 0) {
      // Face(s) detected
      res.json({
        faceDetected: true,
        message: "Face detected successfully.",
        details: rekognitionData.FaceDetails,
      });
    } else {
      // No faces detected
      res.json({
        faceDetected: false,
        message: "No face detected in the image.",
      });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("An error occurred while detecting faces.");
  }
});

app.post("/porichoy-basic", async (req, res) => {
  const convertDateFormat = (dateString) => {
    // Define the month abbreviations
    const months = {
      Jan: "01",
      Feb: "02",
      Mar: "03",
      Apr: "04",
      May: "05",
      Jun: "06",
      Jul: "07",
      Aug: "08",
      Sep: "09",
      Oct: "10",
      Nov: "11",
      Dec: "12",
    };

    // Split the input date string
    const [day, monthAbbr, year] = dateString.split(" ");

    // Convert the month abbreviation to month number
    const month = months[monthAbbr];

    // Return the date in YYYY-MM-DD format
    return `${year}-${month}-${day.padStart(2, "0")}`;
  };

  const { name, dob, nid } = req.body;

  try {
    const requestData = {
      national_id: nid,
      person_dob: convertDateFormat(dob),
      person_fullname: name,
    };

    console.log("Transformed data for....", requestData);

    // Call /api/v2/verifications/basic-nid with the transformed data
    try {
      const verificationResponse = await axios.post(
        "https://api.porichoybd.com/api/v2/verifications/basic-nid",
        requestData,
        {
          headers: {
            "x-api-key": process.env.YOUR_PORICHOY_API_KEY, // Set your API key here
          },
        }
      );

      // Send the response from the verification API
      res.json(verificationResponse.data);
    } catch (verificationError) {
      console.error(
        "Error occurred while calling verification API:",
        verificationError
      );
      res
        .status(500)
        .send("An error occurred while calling the verification API.");
    }
  } catch (detectTextError) {
    console.error(
      "Error occurred while calling /detect-text:",
      detectTextError
    );
    res.status(500).send("An error occurred while analyzing the document.");
  }
});

app.post("/porichoy-birth", async (req, res) => {
  const { birthRegistrationNumber, dateOfBirth } = req.body;

  try {
    const requestData = {
      birthRegistrationNumber,
      dateOfBirth,
    };

    console.log("Transformed data for....", requestData);

    // Call /api/v2/verifications/basic-nid with the transformed data
    try {
      const verificationResponse = await axios.post(
        "https://api.porichoybd.com/api/v1/verifications/autofill",
        requestData,
        {
          headers: {
            "x-api-key": process.env.YOUR_PORICHOY_API_KEY, // Set your API key here
          },
        }
      );

      // Send the response from the verification API
      res.json(verificationResponse.data);
    } catch (verificationError) {
      console.error(
        "Error occurred while calling verification API:",
        verificationError
      );
      res
        .status(500)
        .send("An error occurred while calling the verification API.");
    }
  } catch (detectTextError) {
    console.error(
      "Error occurred while calling /detect-text:",
      detectTextError
    );
    res.status(500).send("An error occurred while analyzing the document.");
  }
});
// Endpoint to upload passport
app.post("/upload-passport", async (req, res) => {
  const { image } = req.body;

  if (!image) {
    return res.status(400).send("No image data provided.");
  }

  // Extract Base64 data from image string
  const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");

  //const fileName = `image-${Date.now()}.jpg`;
  const fileName = `passport.jpg`;
  const params = {
    Bucket: process.env.YOUR_S3_BUCKET_NAME,
    Key: fileName,
    Body: buffer,
    ContentType: "image/jpg",
  };

  try {
    // Upload image to S3
    const s3Data = await s3.upload(params).promise();
    const imageUrl = s3Data.Location;

    res.json({
      imageUrl,
      fileName,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("An error occurred while uploading the image.");
  }
});

app.post("/analyze-passport", async (req, res) => {
  console.log("Endpoint /analyze-passport was hit.");

  const formatDate = (yyMMdd) => {
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const year = parseInt(yyMMdd.substring(0, 2), 10);
    const month = parseInt(yyMMdd.substring(2, 4), 10) - 1;
    const day = parseInt(yyMMdd.substring(4, 6), 10);

    const fullYear = year >= 50 ? 1900 + year : 2000 + year;
    return `${day} ${monthNames[month]} ${fullYear}`;
  };

  const extractMRZFields = (mrz) => {
    return {
      passportNumber: mrz.substring(0, 9),
      passportNumberCheckDigit: parseInt(mrz[9]),
      birthDate: mrz.substring(13, 19),
      birthDateCheckDigit: parseInt(mrz[19]),
      expirationDate: mrz.substring(21, 27),
      expirationDateCheckDigit: parseInt(mrz[27]),
      personalNumber: mrz.substring(28, 42),
      personalNumberCheckDigit: parseInt(mrz[42]),
      finalCheckDigit: parseInt(mrz[43]),
    };
  };

  const getRequiredFields = (mrzFields) => {
    return {
      passportNumber: mrzFields.passportNumber || null,
      birthDate: mrzFields.birthDate ? formatDate(mrzFields.birthDate) : null,
      expirationDate: mrzFields.expirationDate
        ? formatDate(mrzFields.expirationDate)
        : null,
      personalNumber: mrzFields.personalNumber
        ? mrzFields.personalNumber.substring(0, 10)
        : null,
    };
  };

  const { imageUrl } = req.body;

  if (!imageUrl) {
    return res.status(400).send("No image URL provided.");
  }

  const params = {
    Document: {
      S3Object: {
        Bucket: process.env.YOUR_S3_BUCKET_NAME,
        Name: imageUrl.split("/").pop(),
      },
    },
  };

  try {
    const textractData = await textract.detectDocumentText(params).promise();
    const jsonData = textractData.Blocks;

    // Filter blocks to get lines of text
    const lineBlocks = jsonData.filter((block) => block.BlockType === "LINE");

    // Initialize variables and set defaults to null
    let name = null;
    const nameMrzLine =
      lineBlocks.length > 1 ? lineBlocks[lineBlocks.length - 2] : null;

    const extractNameFromMRZ = (mrzLine) => {
      if (!mrzLine) return null;
      let cleanedLine = mrzLine.replace(/^P</, "").replace(/</g, " ").trim();
      let nameParts = cleanedLine.split(/\s+/);
      let lastName = nameParts[0].replace(/^BGD/, ""); // Remove "BGD" from the last name if it exists
      let givenNames = nameParts.slice(1).join(""); // Join the rest as given names
      return `${givenNames}${lastName}`.toUpperCase();
    };

    if (nameMrzLine) {
      name = extractNameFromMRZ(nameMrzLine.Text) || null;
      console.log("Name:", name);
    } else {
      console.log("Name MRZ line not found.");
    }

    const lastLineBlock =
      lineBlocks.length > 0 ? lineBlocks[lineBlocks.length - 1] : null;
    const mrzCodeText = lastLineBlock ? lastLineBlock.Text : null;

    if (mrzCodeText) {
      const mrzFields = extractMRZFields(mrzCodeText);
      const responseData = getRequiredFields(mrzFields);

      responseData.name = name;

      const success = Object.values(responseData).every(
        (value) => value !== null
      );

      res.json({
        status: success ? "success" : "fail",
        passportData: responseData,
      });
    } else {
      res.status(404).send("MRZ code not found.");
    }
  } catch (error) {
    console.error("Textract error:", error);
    res.status(500).send("An error occurred while analyzing the document.");
  }
});

app.all("/bkash/callback", (req, res) => {
  console.log(req.query);
  res.end();
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
