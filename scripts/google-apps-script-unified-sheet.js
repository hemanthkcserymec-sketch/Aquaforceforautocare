/**
 * =========================================================================
 * AMEC AQUAFORCE - UNIFIED GOOGLE SPREADSHEET WEBHOOK SCRIPT
 * =========================================================================
 * Routes all incoming website events into a SINGLE Main Google Spreadsheet
 * across 3 dedicated tabs (worksheets):
 * 
 * 1. "SignUp Sheet"         -> Verified Customer OTP Leads & Newsletter signups
 * 2. "Bulk Inquiry Sheet"   -> B2B / Bulk Purchase enquiries
 * 3. "Order Received Sheet" -> Completed Purchases, Payments, Invoices & Tracking
 * =========================================================================
 * 
 * SETUP INSTRUCTIONS:
 * 1. Create ONE new Google Spreadsheet in your Google Drive (e.g., named
 *    "AMEC Aquaforce - Retail (Autocare)" or "AMEC Aquaforce - Commercial (Gig Workers)").
 * 2. In that Google Spreadsheet menu, go to: Extensions -> Apps Script.
 * 3. Delete any default code in Code.gs, paste this entire file, and click Save (💾).
 * 4. Click the blue "Deploy" button at top right -> "New deployment".
 * 5. Select type: "Web app".
 * 6. Set Description: "Aquaforce Unified Webhook".
 * 7. Set "Execute as": "Me" (your email).
 * 8. Set "Who has access": "Anyone" (crucial so the website can post data).
 * 9. Click "Deploy", authorize Google permissions, and copy the Web App URL.
 *    (e.g., https://script.google.com/macros/s/.../exec)
 * 10. Paste this single URL into your website environment variable:
 *     GOOGLE_SHEET_MAIN_URL="https://script.google.com/macros/s/.../exec"
 * =========================================================================
 */

// Tab Names inside the single Main Spreadsheet
var TAB_NAMES = {
  SIGNUPS: "SignUp Sheet",
  ENQUIRIES: "Bulk Inquiry Sheet",
  PURCHASES: "Order Received Sheet"
};

// Column Headers for each tab
var HEADERS = {
  SIGNUPS: [
    "Timestamp",
    "Customer Name",
    "Phone Number",
    "Source",
    "Status"
  ],
  ENQUIRIES: [
    "Timestamp",
    "Customer Name",
    "Phone Number",
    "Company Name",
    "Email",
    "Quantity Required",
    "Purchase Timeline",
    "Customer Type / Notes",
    "Status"
  ],
  PURCHASES: [
    "Timestamp",
    "Order ID",
    "Payment ID",
    "Payment Method",
    "Product",
    "Quantity",
    "Total Amount (INR)",
    "Advance Paid (INR)",
    "COD Balance Due (INR)",
    "Customer Name",
    "Phone Number",
    "Alternate Phone",
    "Email",
    "Delivery Address",
    "City",
    "State",
    "Pincode",
    "GST Number",
    "Waybill / Tracking",
    "Order Status"
  ]
};

/**
 * Handle GET requests (Health check and status)
 */
function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ContentService.createTextOutput(JSON.stringify({
    status: "OK",
    message: "Aquaforce Unified Google Sheets Webhook is Active",
    spreadsheetName: ss ? ss.getName() : "Active Spreadsheet",
    tabs: [
      TAB_NAMES.SIGNUPS,
      TAB_NAMES.ENQUIRIES,
      TAB_NAMES.PURCHASES
    ]
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle incoming POST requests from the website
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(15000); // 15-second mutex to prevent concurrency issues

  try {
    var rawData = e && e.postData && e.postData.contents ? e.postData.contents : null;
    var data = {};

    if (rawData) {
      try {
        data = JSON.parse(rawData);
      } catch (parseErr) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    var targetType = (data.type || "").toUpperCase();

    // Determine target tab if type was not explicitly passed
    if (!targetType) {
      if (data.orderId || data.paymentId || data.advanceAmount !== undefined) {
        targetType = "PURCHASE";
      } else if (data.companyName || data.quantity > 1 || data.purchaseTimeline || data.timeline) {
        targetType = "ENQUIRY";
      } else {
        targetType = "SIGNUP";
      }
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var timestamp = data.timestamp || Utilities.formatDate(new Date(), "Asia/Kolkata", "dd/MM/yyyy, hh:mm:ss a");
    var resultMessage = "";

    // -------------------------------------------------------------
    // 1. ORDER RECEIVED (Purchases & Checkouts)
    // -------------------------------------------------------------
    if (targetType === "PURCHASE" || targetType === "PURCHASES" || targetType === "ORDER") {
      var purchaseSheet = getOrCreateTab(ss, TAB_NAMES.PURCHASES, HEADERS.PURCHASES, "#0066cc");

      var altPhone = data.alternatePhone || data.altPhone || "N/A";
      var waybill = data.waybill || data.delhiveryWaybill || data.shiprocketWaybill || "PENDING";
      var cleanPincode = data.pincode ? "'" + String(data.pincode) : "N/A";
      var cleanPhone = data.phone ? "'" + String(data.phone) : "N/A";
      var cleanAltPhone = (altPhone && altPhone !== "N/A") ? "'" + String(altPhone) : "N/A";

      purchaseSheet.appendRow([
        timestamp,
        data.orderId || "N/A",
        data.paymentId || "N/A",
        data.paymentMethod || "Full Online Payment",
        data.product || "Cordless AquaForce 1400",
        Number(data.quantity) || 1,
        Number(data.amount) || "",
        Number(data.advanceAmount) || 0,
        Number(data.codBalance) || 0,
        data.fullName || "N/A",
        cleanPhone,
        cleanAltPhone,
        data.email || "N/A",
        data.deliveryAddress || "N/A",
        data.city || "N/A",
        data.state || "N/A",
        cleanPincode,
        data.gstNumber || "N/A",
        waybill,
        data.status || "CONFIRMED"
      ]);

      resultMessage = "Recorded in " + TAB_NAMES.PURCHASES;
    }

    // -------------------------------------------------------------
    // 2. BULK INQUIRY (B2B & Commercial Leads)
    // -------------------------------------------------------------
    else if (
      targetType === "INQUIRY" ||
      targetType === "INQUIRIES" ||
      targetType === "ENQUIRY" ||
      targetType === "ENQUIRIES"
    ) {
      var enquirySheet = getOrCreateTab(ss, TAB_NAMES.ENQUIRIES, HEADERS.ENQUIRIES, "#0d9488");

      var notesVal = data.notesSummary || data.notes || (data.purchaseTimeline ? "Plan: " + data.purchaseTimeline + " | Type: " + (data.customerType || "N/A") : "N/A");
      var cleanInquiryPhone = data.phone ? "'" + String(data.phone) : "N/A";

      enquirySheet.appendRow([
        timestamp,
        data.fullName || data.name || "N/A",
        cleanInquiryPhone,
        data.companyName || data.company || "N/A",
        data.email || "N/A",
        data.quantity || "N/A",
        data.purchaseTimeline || data.timeline || "Not specified",
        data.customerType || notesVal,
        data.status || "New Inquiry"
      ]);

      resultMessage = "Recorded in " + TAB_NAMES.ENQUIRIES;
    }

    // -------------------------------------------------------------
    // 3. SIGNUP (Customer Registrations & OTP Verified Leads)
    // -------------------------------------------------------------
    else {
      var signupSheet = getOrCreateTab(ss, TAB_NAMES.SIGNUPS, HEADERS.SIGNUPS, "#7c3aed");
      var cleanSignupPhone = data.phone ? "'" + String(data.phone) : "N/A";

      signupSheet.appendRow([
        timestamp,
        data.fullName || data.name || "Customer",
        cleanSignupPhone,
        data.source || "Website Buy Now (OTP Verified)",
        data.status || "Verified Lead"
      ]);

      resultMessage = "Recorded in " + TAB_NAMES.SIGNUPS;
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: resultMessage,
      targetType: targetType
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Helper to get an existing tab or create and format it with headers
 */
function getOrCreateTab(spreadsheet, tabName, headers, headerColor) {
  var sheet = spreadsheet.getSheetByName(tabName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(tabName);
  }
  setupHeaders(sheet, headers, headerColor);
  return sheet;
}

/**
 * Formats table header row with custom brand color and frozen top row
 */
function setupHeaders(sheet, headers, headerColor) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    var range = sheet.getRange(1, 1, 1, headers.length);
    range.setFontWeight("bold");
    range.setBackground(headerColor || "#0066cc");
    range.setFontColor("#ffffff");
    range.setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
    for (var i = 1; i <= headers.length; i++) {
      sheet.autoResizeColumn(i);
    }
  }
}
