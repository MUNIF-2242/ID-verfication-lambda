const AWS = require("aws-sdk");
const textract = new AWS.Textract();

exports.handler = async (event) => {
  console.log("Lambda function /analyze-passport was invoked.");

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

  const { imageUrl } = JSON.parse(event.body);

  if (!imageUrl) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "No image URL provided." }),
    };
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

      return {
        statusCode: 200,
        body: JSON.stringify({
          status: success ? "success" : "fail",
          passportData: responseData,
        }),
      };
    } else {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "MRZ code not found." }),
      };
    }
  } catch (error) {
    console.error("Textract error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "An error occurred while analyzing the document.",
      }),
    };
  }
};
