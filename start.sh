#!/bin/bash

# Define paths to files and webhook URL
CSV_FILE="./csv_files/phone_prices_$(date +'%Y-%m-%d').csv"
API_LOG="./logs/api.log"
ERROR_LOG="./logs/error.log"
WEBHOOK_URL="https://discord.com/api/webhooks/1333314349758152795/3m-8AMWTUrqcqjI4HEX58ZSMNpbUp3SPi3IK6IcMz4aEXGSS5TjmVdZlwotyYxuL9ZKw"
MONTHS=3
HOURS=0
MINUTES=0
SECONDS=0

# Function to send files to Discord and delete logs after sending
# Function to send files to Discord and delete logs after sending
send_to_discord() {
    # Calculate the next refresh date
    NEXT_REFRESH=$(date -d "$MONTHS months $HOURS hours $MINUTES minutes" +'%Y-%m-%d %H:%M:%S')

    # Create the embed message
    EMBED="{
        \"embeds\": [
            {
                \"title\": \"Phone Price Data - $(date +'%Y-%m-%d')\",
                \"description\": \"Here is the latest data for phone prices.\",
                \"color\": 3066993,
                \"fields\": [
                    {
                        \"name\": \"Creation Date\",
                        \"value\": \"$(date +'%Y-%m-%d')\"
                    },
                    {
                        \"name\": \"Next Refresh\",
                        \"value\": \"The next refresh will occur on $NEXT_REFRESH\"
                    },
                    {
                        \"name\": \"Timer\",
                        \"value\": \"Set to refresh every $MONTHS month(s), $HOURS hour(s), and $MINUTES minute(s)\"
                    }
                ]
            }
        ]
    }"

    # Debugging: Print the file paths
    echo "CSV File Path: $CSV_FILE"
    echo "API Log Path: $API_LOG"
    echo "Error Log Path: $ERROR_LOG"

    # Check if files exist before sending
    if [[ ! -f "$CSV_FILE" || ! -f "$API_LOG" || ! -f "$ERROR_LOG" ]]; then
        echo "Error: One or more files do not exist!"
        exit 1
    fi

    # Send the embed message (JSON) and files (multipart) to Discord
    curl -X POST "$WEBHOOK_URL" \
        -H "Content-Type: multipart/form-data" \
        -F "payload_json=$EMBED" \
        -F "file1=@$CSV_FILE" \
        -F "file2=@$API_LOG" \
        -F "file3=@$ERROR_LOG"

    # Check if the log files exist before deleting
    if [[ -f "$API_LOG" ]]; then
        echo "Deleting API log file..."
        rm -f "$API_LOG"
        echo "API log file deleted."
    else
        echo "API log file does not exist, skipping deletion."
    fi

    if [[ -f "$ERROR_LOG" ]]; then
        echo "Deleting error log file..."
        rm -f "$ERROR_LOG"
        echo "Error log file deleted."
    else
        echo "Error log file does not exist, skipping deletion."
    fi
}

# Function to convert months, hours, and minutes to seconds
convert_to_seconds() {
    local months=$1
    local hours=$2
    local minutes=$3

    # Calculate seconds
    local seconds=$((months * 30 * 24 * 60 * 60 + hours * 3600 + minutes * 60))
    echo $seconds
}

# Function to prompt for user input with validation
get_user_input() {
    echo "Please enter the time interval for running the script:"
    echo "For example, to run every 1 month, 2 hours, and 30 minutes, input '1 2 30'."
    read -p "Months: " months
    read -p "Hours: " hours
    read -p "Minutes: " minutes

    # Validate input
    if [[ ! "$months" =~ ^[0-9]+$ ]] || [[ ! "$hours" =~ ^[0-9]+$ ]] || [[ ! "$minutes" =~ ^[0-9]+$ ]]; then
        echo "Invalid input! Please enter numeric values."
        exit 1
    fi

    # Convert the input time to seconds
    time_in_seconds=$(convert_to_seconds $months $hours $minutes)
    MONTHS=$months
    HOURS=$hours
    MINUTES=$minutes
    echo "The script will run every $months month(s), $hours hour(s), and $minutes minute(s), which is $time_in_seconds seconds."
}

# Function to display a cool progress bar
display_progress() {
    echo -n "Running phone data script"
    while true; do
        echo -n "."
        sleep 1
    done &
    PROGRESS_PID=$!
}

# Function to stop the progress bar
stop_progress() {
    kill $PROGRESS_PID
    echo -e "\nPhone data script completed."
}

# Start the user input process
get_user_input

# Loop to run the phone data script at the specified interval
while true; do
    # Start progress bar
    display_progress

    # Run the phone data generation script
    echo "Running phone data script..."
    node mock.js  # Replace with your actual script name

    # Stop progress bar
    stop_progress

    # Send the files to Discord
    echo "Sending data to Discord..."
    send_to_discord

    # Wait for the specified amount of time before running again
    echo "Waiting for the next run..."
    sleep $time_in_seconds  # Sleep for the user-defined time interval
done
