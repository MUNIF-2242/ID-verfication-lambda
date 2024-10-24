const axios = require("axios");

exports.handler = async (event) => {
  const { birthRegistrationNumber, dateOfBirth } = JSON.parse(event.body);

  const requestData = {
    birthRegistrationNumber,
    dateOfBirth,
  };

  console.log("Transformed data for request:", requestData);

  try {
    const verificationResponse = await axios.post(
      "https://api.porichoybd.com/api/v1/verifications/autofill",
      requestData,
      {
        headers: {
          "x-api-key": process.env.YOUR_PORICHOY_API_KEY,
        },
      }
    );

    return {
      statusCode: 200,
      body: JSON.stringify(verificationResponse.data),
    };
  } catch (verificationError) {
    console.error(
      "Error occurred while calling verification API:",
      verificationError
    );

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "An error occurred while calling the verification API.",
        error: verificationError.message,
      }),
    };
  }
};
