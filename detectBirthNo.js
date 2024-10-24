const AWS = require("aws-sdk");
const textract = new AWS.Textract();

exports.handler = async (event) => {
  console.log("Lambda function was triggered.");

  const body = JSON.parse(event.body);
  const { fileName } = body;

  if (!fileName) {
    console.log("No fileName provided.");
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "No file name provided." }),
    };
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

    // Find the line that contains "Birth Registration No:"
    const birthRegNoLine = lineBlocks.find((lineBlock) =>
      lineBlock.Text.includes("Birth Registration No:")
    );

    // Find the line that contains "Date of Birth:"
    const dobLine = lineBlocks.find((lineBlock) =>
      lineBlock.Text.includes("Date of Birth:")
    );

    // Define a regular expression to extract numbers
    const numberRegex = /\d+/g;

    // Define a regular expression to extract date in the format dd-mm-yyyy or similar
    const dateRegex = /(\d{2})[-\/](\d{2})[-\/](\d{4})/;

    // Extract the birth registration number
    const birthRegNo = birthRegNoLine
      ? birthRegNoLine.Text.match(numberRegex).join("")
      : null;

    // Extract the date of birth and format it to YYYY-MM-DD
    const dob = dobLine
      ? dobLine.Text.match(dateRegex)
        ? formatDateToISO(dobLine.Text.match(dateRegex))
        : null
      : null;

    if (birthRegNo || dob) {
      console.log("Extracted data:", {
        birthRegistrationNumber: birthRegNo,
        dateOfBirth: dob,
      });
      return {
        statusCode: 200,
        body: JSON.stringify({
          data: {
            birthRegistrationNumber: birthRegNo,
            dateOfBirth: dob,
          },
        }),
      };
    } else {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: "Birth Registration Number or Date of Birth not found.",
        }),
      };
    }
  } catch (error) {
    console.error("Error occurred while detecting text:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "An error occurred while detecting text.",
      }),
    };
  }
};

// Function to format date to YYYY-MM-DD
function formatDateToISO(dateMatchArray) {
  const [_, day, month, year] = dateMatchArray;
  return `${year}-${month}-${day}`;
}
