const axios = require("axios");

exports.handler = async (event) => {
  // Define the convertDateFormat function
  const convertDateFormat = (dateString) => {
    if (!dateString) return ""; // Handle undefined or null dateString

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

    const [day, monthAbbr, year] = dateString.split(" ");
    const month = months[monthAbbr];
    return `${year}-${month}-${day.padStart(2, "0")}`;
  };

  try {
    // Extract request data from the event object
    const { name, dob, nid } = JSON.parse(event.body);

    // Validate input data
    if (!name || !dob || !nid) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Missing required fields: name, dob, or nid.",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      };
    }

    // Transform the data
    const requestData = {
      national_id: nid,
      person_dob: convertDateFormat(dob),
      person_fullname: name,
    };

    console.log("Transformed data for verification:", requestData);

    // Call the verification API
    const verificationResponse = await axios.post(
      "https://api.porichoybd.com/api/v2/verifications/basic-nid",
      requestData,
      {
        headers: {
          "x-api-key": process.env.YOUR_PORICHOY_API_KEY, // Set your API key here
        },
      }
    );

    // Return the response from the verification API
    return {
      statusCode: 200,
      body: JSON.stringify(verificationResponse.data),
      headers: {
        "Content-Type": "application/json",
      },
    };
  } catch (verificationError) {
    console.error(
      "Error occurred while calling verification API:",
      verificationError
    );

    // Return an error response
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "An error occurred while calling the verification API.",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    };
  }
};
