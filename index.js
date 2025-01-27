const axios = require("axios");
const fs = require("fs");
const { format } = require("date-fns");
const path = require("path");

// Constants
const CSV_DIR = "csv_files"; // New directory for CSV files
const LOGS_DIR = "logs";
const API_ENDPOINT = "https://buybackboss.com/api.php";
const REQUEST_DELAY = 1000; // 1 second delay between requests
const SHOULD_LOG = false;

// Logging file paths
const API_LOG_FILE = path.join(LOGS_DIR, "api.log");
const ERROR_LOG_FILE = path.join(LOGS_DIR, "error.log");

// Ensure directories exist
function ensureDirectories() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR);
  }
  if (!fs.existsSync(CSV_DIR)) {
    fs.mkdirSync(CSV_DIR);
  }
}

// Generate CSV file path with current date
function getCSVFilePath() {
  const dateString = format(new Date(), "yyyy-MM-dd");
  const fileName = `phone_prices_${dateString}.csv`;
  return path.join(CSV_DIR, fileName);
}

// Logging utility functions
function logToFile(filePath, message) {
  const timestamp = format(new Date(), "yyyy-MM-dd HH:mm:ss");
  const logEntry = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(filePath, logEntry);
}

function logAPI(type, message, data = null) {
  const logMessage = `[${type}] ${message}${data ? '\nData: ' + JSON.stringify(data, null, 2) : ''}`;
  logToFile(API_LOG_FILE, logMessage);
}

function logError(error, context = '') {
  const errorMessage = `[ERROR] ${context}\n${error.stack || error.message || error}`;
  logToFile(ERROR_LOG_FILE, errorMessage);
  console.error(errorMessage);
}

// Function to append data to the CSV
function appendToCSV(data) {
  const CSV_FILE_PATH = getCSVFilePath(); // Get the CSV file path with the current date

  try {
    const csvRow = Object.values(data).join(",") + "\n";
    if (SHOULD_LOG) console.log("Writing row to CSV:", csvRow.trim());
    logAPI('CSV', 'Writing row to CSV', data);

    if (!fs.existsSync(CSV_FILE_PATH)) {
      const headers = "Timestamp,Phone Model,Carrier,Storage,Condition,Price\n";
      fs.writeFileSync(CSV_FILE_PATH, headers);
      logAPI('CSV', 'Created new CSV file with headers');
    }

    fs.appendFileSync(CSV_FILE_PATH, csvRow);
  } catch (error) {
    logError(error, 'Failed to write to CSV');
    console.error("Failed to write to CSV:", error);
  }
}

// Function to fetch data from the API
async function fetchData(attrOptions) {
  const currentStep = attrOptions.join(" > ");
  console.log(`Fetching data for: ${currentStep}`);

  try {
    const payload = { product_group: "apple-phone", attr_options: attrOptions };

    logAPI('REQUEST', `Endpoint: ${API_ENDPOINT}`, {
      step: currentStep,
      payload: payload,
    });

    const response = await axios.post(API_ENDPOINT, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 10000,
    });

    logAPI('RESPONSE', `Status: ${response.status}`, {
      step: currentStep,
      data: response.data,
    });

    return response.data;
  } catch (error) {
    const errorDetails = {
      step: currentStep,
      message: error.message,
      code: error.code,
      response: error.response
        ? {
            status: error.response.status,
            data: error.response.data,
          }
        : null,
    };

    logError(error, `API Request Failed for ${currentStep}`);
    logAPI('ERROR', `Failed request for ${currentStep}`, errorDetails);

    console.error(`Error fetching data for ${currentStep}:`, error.message);
    return null;
  }
}

// Extraction functions
function extractPhoneModel(selectedOptionList) {
  const iPhoneOptions = selectedOptionList.filter((option) =>
    option.option_name.startsWith("iPhone")
  );

  if (iPhoneOptions.length > 0) {
    return iPhoneOptions.reduce((longest, current) =>
      current.option_name.length > longest.option_name.length ? current : longest
    ).option_name;
  }

  return "Unknown Model";
}

function extractCarrier(selectedOptionList) {
  const carriers = ["AT&T", "T-Mobile", "Verizon", "Unlocked", "Other"];
  const carrierOption = selectedOptionList.find((option) =>
    carriers.includes(option.option_name)
  );
  return carrierOption ? carrierOption.option_name : "Unknown Carrier";
}

function isValidStorage(storage) {
  return storage && (storage.includes("GB") || storage.includes("TB"));
}

function extractStorage(selectedOptionList) {
  const storageOption = selectedOptionList.find(
    (option) =>
      option.option_name.includes("GB") || option.option_name.includes("TB")
  );
  return storageOption ? storageOption.option_name : undefined;
}

// Function to process the response and extract data
async function processResponse(data, attrOptions) {
  if (!data) {
    logAPI('PROCESS', 'No data to process', { attrOptions });
    return;
  }

  try {
    logAPI('PROCESS', 'Starting data processing', { attrOptions });

    if (data.productList && data.productList[0]?.price_6 !== undefined) {
      const phoneModel = extractPhoneModel(data.selectedOptionList);
      const carrier = extractCarrier(data.selectedOptionList);
      const storage = extractStorage(data.selectedOptionList);

      if (!isValidStorage(storage)) {
        logAPI('SKIP', `Invalid storage option: ${storage}`);
        console.log(`Skipping invalid storage option: ${storage}`);
        return;
      }

      if (!phoneModel || !carrier || !storage) {
        logAPI('ERROR', 'Missing required data fields', {
          phoneModel,
          carrier,
          storage,
        });
        console.error("Missing required data fields:", {
          phoneModel,
          carrier,
          storage,
        });
        return;
      }

      if (SHOULD_LOG)
        console.log(`Processing data for: ${phoneModel}, ${carrier}, ${storage}`);
      logAPI('INFO', 'Parsed product details', { phoneModel, carrier, storage });

      const conditions = [
        { id: "6", name: "Brand New", priceKey: "price_6" },
        { id: "5", name: "Flawless", priceKey: "price_5" },
        { id: "4", name: "Good", priceKey: "price_4" },
        { id: "11", name: "Average", priceKey: "price_11" },
        { id: "3", name: "Fair", priceKey: "price_3" },
        { id: "1", name: "Faulty", priceKey: "price_1" },
      ];

      for (const product of data.productList) {
        for (const condition of conditions) {
          if (product[condition.priceKey]) {
            const timestamp = format(new Date(), "yyyy-MM-dd HH:mm:ss");
            const price = product[condition.priceKey];

            logAPI('PRICE', `Found price for ${phoneModel}`, {
              condition: condition.name,
              price: price,
            });

            appendToCSV({
              Timestamp: timestamp,
              "Phone Model": phoneModel,
              Carrier: carrier,
              Storage: storage,
              Condition: condition.name,
              Price: price,
            });
          }
        }
      }
    } else if (data.productList) {
      for (const option of data.productList) {
        await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY));
        await fetchAndProcessData([...attrOptions, option.url]);
      }
    }
  } catch (error) {
    logError(error, 'Error in processResponse');
    throw error;
  }
}

// Recursive function to fetch and process data
async function fetchAndProcessData(attrOptions = ["apple", "iphone"]) {
  const data = await fetchData(attrOptions);
  await processResponse(data, attrOptions);
}

// Initialize logging and directories
function initialize() {
  ensureDirectories();
  const startMessage = '='.repeat(50) + '\nScript Started\n' + '='.repeat(50);
  logToFile(API_LOG_FILE, startMessage);
  logToFile(ERROR_LOG_FILE, startMessage);
}

// Main function
(async () => {
  try {
    initialize();
    console.log("Starting script...");
    const startTime = Date.now();

    await fetchAndProcessData();

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    const completionMessage = `Script completed in ${duration} seconds`;
    console.log(completionMessage);
    logAPI('INFO', completionMessage);
  } catch (error) {
    logError(error, 'Fatal error in main execution');
    console.error("Fatal error:", error);
  }
})();