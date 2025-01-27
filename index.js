const axios = require("axios");
const fs = require("fs");
const { format } = require("date-fns");

const CSV_FILE_PATH = "phone_prices.csv";
const API_ENDPOINT = "https://buybackboss.com/api.php";
const REQUEST_DELAY = 1000; // 1 second delay between requests

// Function to append data to the CSV
function appendToCSV(data) {
  try {
    const csvRow = Object.values(data).join(",") + "\n";
    console.log("Writing row to CSV:", csvRow.trim());

    if (!fs.existsSync(CSV_FILE_PATH)) {
      const headers = "Timestamp,Phone Model,Carrier,Storage,Condition,Price\n";
      fs.writeFileSync(CSV_FILE_PATH, headers);
    }

    fs.appendFileSync(CSV_FILE_PATH, csvRow);
  } catch (error) {
    console.error("Failed to write to CSV:", error);
  }
}

// Function to fetch data from the API
async function fetchData(attrOptions) {
  const currentStep = attrOptions.join(" > ");
  console.log(`Fetching data for: ${currentStep}`);

  try {
    const payload = { product_group: "apple-phone", attr_options: attrOptions };
    const response = await axios.post(API_ENDPOINT, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 10000,
    });

    return response.data;
  } catch (error) {
    console.error(`Error fetching data for ${currentStep}:`, error.message);
    return null;
  }
}

// Function to extract the phone model from the selectedOptionList
function extractPhoneModel(selectedOptionList) {
    // Find all options that start with "iPhone"
    const iPhoneOptions = selectedOptionList.filter(option => 
      option.option_name.startsWith("iPhone")
    );
    
    // If we have multiple iPhone options, return the one with the longest name
    // as it's likely to be the most specific (e.g., "iPhone 16 Pro Max" instead of just "iPhone")
    if (iPhoneOptions.length > 0) {
      return iPhoneOptions.reduce((longest, current) => 
        current.option_name.length > longest.option_name.length 
          ? current 
          : longest
      ).option_name;
    }
    
    return "Unknown Model";
  }
  

// Function to extract the carrier from the selectedOptionList
function extractCarrier(selectedOptionList) {
  // List of known carriers
  const carriers = ["AT&T", "T-Mobile", "Verizon", "Unlocked", "Other"];
  const carrierOption = selectedOptionList.find((option) =>
    carriers.includes(option.option_name)
  );
  return carrierOption ? carrierOption.option_name : "Unknown Carrier";
}

// Function to validate if the storage option is valid
function isValidStorage(storage) {
  return storage && (storage.includes("GB") || storage.includes("TB")); // Ensure storage option includes "GB" or "TB"
}

// Function to extract the storage from the selectedOptionList
function extractStorage(selectedOptionList) {
  const storageOption = selectedOptionList.find(
    (option) => option.option_name.includes("GB") || option.option_name.includes("TB")
  );
  return storageOption ? storageOption.option_name : undefined;
}

// Function to process the response and extract data
async function processResponse(data, attrOptions) {
  if (!data) return;

  // If productList contains pricing data, extract and write to CSV
  if (data.productList && data.productList[0]?.price_6 !== undefined) {
    const phoneModel = extractPhoneModel(data.selectedOptionList);
    const carrier = extractCarrier(data.selectedOptionList);
    const storage = extractStorage(data.selectedOptionList);

    // Skip if storage is invalid or missing
    if (!isValidStorage(storage)) {
      console.log(`Skipping invalid storage option: ${storage}`);
      return;
    }

    if (!phoneModel || !carrier || !storage) {
      console.error("Missing required data fields:", {
        phoneModel,
        carrier,
        storage,
      });
      return;
    }

    console.log(`Parsed data: phoneModel=${phoneModel}, carrier=${carrier}, storage=${storage}`);

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

          console.log(`Found price for condition ${condition.name}: $${price}`);

          appendToCSV({
            Timestamp: timestamp,
            "Phone Model": phoneModel,
            Carrier: carrier,
            Storage: storage,
            Condition: condition.name,
            Price: price,
          });

          console.log(`Logged: ${phoneModel} | ${carrier} | ${storage} | ${condition.name} | $${price}`);
        } else {
          console.log(`No price found for condition: ${condition.name}`);
        }
      }
    }
  }
  // If productList contains further options, recursively fetch data
  else if (data.productList) {
    for (const option of data.productList) {
      await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY)); // Add delay
      await fetchAndProcessData([...attrOptions, option.url]);
    }
  }
}

// Recursive function to fetch and process data
async function fetchAndProcessData(attrOptions = ["apple", "iphone"]) {
  const data = await fetchData(attrOptions);
  await processResponse(data, attrOptions);
}

// Main function
(async () => {
  try {
    console.log("Starting script...");
    const startTime = Date.now();

    await fetchAndProcessData();

    const endTime = Date.now();
    console.log(`Script completed in ${(endTime - startTime) / 1000} seconds.`);
  } catch (error) {
    console.error("Fatal error:", error);
  }
})();