const AWS = require("aws-sdk");

const textract = new AWS.Textract();

exports.handler = async (event) => {
  console.log("Endpoint /detect-text was hit.");

  const { fileName } = JSON.parse(event.body);

  if (!fileName) {
    console.log("No fileName provided.");
    return {
      statusCode: 400,
      body: JSON.stringify("No file name provided."),
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
    return {
      statusCode: 200,
      body: JSON.stringify({
        status: success ? "success" : "fail",
        nidData: {
          dob,
          name,
          nid,
        },
      }),
    };
  } catch (error) {
    console.error("Error occurred while detecting text:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        status: "error",
        message: "An error occurred while detecting text.",
      }),
    };
  }
};
