# AWS Lambda Functions for Image Upload, Face Comparison, and Text Detection

## Overview

This project contains AWS Lambda functions to:

1. **Upload a selfie image and a NID (National ID) image to AWS S3.**
2. **Compare the uploaded images using AWS Rekognition to verify if the images match.**
3. **Extract text from the NID image using AWS Textract.**

## Architecture

- **AWS S3**: Used to store the uploaded selfie and NID images.
- **AWS Rekognition**: Used to compare the faces in the uploaded selfie and NID images.
- **AWS Textract**: Used to extract text from the NID image.
- **AWS Lambda**: Contains the logic for uploading images, comparing faces, and extracting text.

## Prerequisites

- **AWS Account**: You need an AWS account to deploy and run these Lambda functions.
- **Node.js**: Install Node.js and npm.

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/your-repository.git
cd your-repository
```

### 2. Configure Environment Variables

Each Lambda function uses environment variables to get the S3 bucket name and other necessary configurations. Update the environment variables in your Lambda function configuration:

- YOUR_S3_BUCKET_NAME: The name of your S3 bucket

### 3. API Gateway Setup

If you want to expose these Lambda functions as APIs, you can create an API Gateway and link it to the respective Lambda functions.

### 4. Usage

- **Upload Selfie Image**: Invoke the `uploadSelfie` Lambda function with the base64-encoded selfie image as input.
- **Upload NID Image**: Invoke the `uploadNid` Lambda function with the base64-encoded NID image as input.
- **Compare Faces**: Invoke the `compareFace` Lambda function with the S3 URLs of the uploaded selfie and NID images to check if the faces match.
- **Detect Text from NID**: Invoke the `detectText` Lambda function with the S3 URL of the NID image to extract text using Textract.

### 5. Example API Payloads

- **Upload Selfie Payload:**:

```bash
{
  "image": "base64-encoded-image-data"
}
```

- **Upload NID Payload:**:

```bash
{
  "image": "base64-encoded-image-data"
}
```

- **Compare Faces Payload:**:

```bash
{
  "selfieUrl": "https://your-bucket.s3.amazonaws.com/selfie.jpg",
  "nidUrl": "https://your-bucket.s3.amazonaws.com/nid.jpg"
}
```

- **Detect Text Payload:**:

```bash
{
  "fileName":"nid.jpg"
}
```

I hope this project helps you easily upload images, compare faces, and extract text from NID images using AWS services. If you have any questions, feedback, or ideas for improvement, feel free to open an issue or contribute to the project. Happy coding!
