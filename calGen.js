var uidCounter = 0;

function main() {
  var input = document.getElementById("quest_content").value;

  // Parse text
  var rows = parseText(input);

  // now we have the table information as they exist, with inferences
  // console.log(rows);
  // could merge the biweekly lab events into a recurring event here

  // Populate table
  var formatTable = document.getElementById("format_table");
  populateFormatTable(rows, formatTable);

  // ICS file header
  var output = "";
  output += "BEGIN:VCALENDAR\n";
  output += "VERSION:2.0\n";
  output += "PRODID:-//Kevin Thai//reQuestCal 1.5//EN\n";

  for (var i=0; i<rows.length; i++) {
    // console.log(rows[i]);
    if (rows[i]["Days & Times"] !== undefined && rows[i]["Days & Times"] !== "TBA" && rows[i]["Days & Times"] !== " ") {
      output += createEvent(rows[i]);
    }
  }

  // End ICS file
  output += "END:VCALENDAR\n";

  document.getElementById("ics_content").value = output;

  // Exporting to file?
  var aasdf = document.getElementById("download_a");
  var file = new Blob([output], {type: 'data:text/ics;charset=utf-8'});
  aasdf.href = URL.createObjectURL(file);
  aasdf.download = "asdf.ics";
  var aasdf = document.getElementById("download_btn");
  aasdf.removeAttribute("disabled");
}

function parseText(input) {
  // Clean up input text
  input = input.split("\n");
  for (var i=input.length-1; i>=0; i--) {
    if (/^\t*$/.exec(input[i])) input.splice(i,1);
  }

  // Iterate through Quest text
  var rows = [];
  for (var i=0; i<input.length; i++) {

    if (result = /(\w+ \d+\w*) - (.+$)/.exec(input[i])) {
      var row = {};
      row["Course Code"] = result[1];
      row["Course Name"] = result[2];
      i++;

      // Skip n lines; this corresponds to the first table, Course Info
      i += input[i].split("\t").length + 1;

      // Get column headings
      var colNames = input[i].split("\t");
      // Trim the headings for trailing spaces
      for (var j=0; j<colNames.length; j++) colNames[j] = colNames[j].trim();
      i++;

      // Distinguish between add'l row in table and end of table (start of Exam Information section)
      while (input[i] !== "Exam Information") {
        row = readRow(row, input, i, colNames);
        rows.push(row);
        i += colNames.length;
      }

    }

  }

  return rows;
}

// Produce a struct with fields named with column headers
function readRow(prevRow, input, i, colNames) {
  // make a deep copy of the previous row struct to carry over inferred values
  var row =  {};
  for (var key in prevRow) row[key] = prevRow[key];
    
  // we've already stripped out all lines that are just tab;
  // every other space should be an empty cell
  for (var j=0; j<colNames.length; j++) {
    if (input[i+j].match(/^[\t\s]*$/)) continue;
    row[colNames[j]] = input[i+j];
  }
  return row;
}

function populateFormatTable(rows, formatTable) {
  // Determine set of components
  var compSet = new Set();
  for (var i=0; i<rows.length; i++) {
    compSet.add(rows[i]["Component"]);
  }
  // default entry in formatting table
  var compStrs = Array.from(compSet.values()).concat("default");

  // Populate table
  var tr0 = document.createElement("tr");
  var tr1 = document.createElement("tr");
  for (var i=0; i<compStrs.length; i++) {
    var td = document.createElement("td");
    var content = document.createTextNode(compStrs[i].concat(" format"));
    td.appendChild(content);
    tr0.appendChild(td);

    td = document.createElement("td");
    content = document.createElement("input");
    content.id = compStrs[i].concat("_format");
    td.appendChild(content);
    tr1.appendChild(td);
  }
  formatTable.replaceChild(tr0, formatTable.childNodes[0]);
  formatTable.replaceChild(tr1, formatTable.childNodes[1]);

  // Components I've seen include LEC, TUT, LAB, TST, SEM, PRJ
  // LEC and TST are the ones for which I have different specifications; the rest can use default
  // Pre-populate input box for LEC, TST, and default
  var inputField;
  inputField = document.getElementById("LEC_format");
  if (inputField != null) inputField.value = "%cc - %cn";
  inputField = document.getElementById("TST_format");
  if (inputField != null) inputField.value = "%cc Midterm";
  document.getElementById("default_format").value = "%cc %comp";
}

function createEvent(rItem) {
	var summary, desc, location, dtstamp, dtstart, dtend, rrule, uid;


  // One of LEC, TUT, LAB, TST, SEM, PRJ, default is used
  // LEC and TST are the ones for which I have different specifications; the rest can use default
  // Summary
  var formatStr = rItem["Component"].concat("_format");
  summary = document.getElementById(formatStr);
  if (summary === null || summary.value === "") { // Either no DOM element returned or the field is empty
    summary = document.getElementById("default_format");
  }
  summary = summary.value;

  // Process substitutions
  summary = summary.split("\\\\");
  for (var i=0; i<summary.length; i++) {
    var temp = summary[i];
    temp = temp.replace(/([^\\]|^)%cc/g, "$1" + rItem["Course Code"]);
    temp = temp.replace(/\\%cc/g, "%cc");
    temp = temp.replace(/([^\\]|^)%cn/g, "$1" + rItem["Course Name"]);
    temp = temp.replace(/\\%cn/g, "%cn");
    temp = temp.replace(/([^\\]|^)%comp/g, "$1" + rItem["Component"]);
    summary[i] = temp.replace(/\\%comp/g, "%comp");
  }
  summary = summary.join("\\");

  // Description
  desc = "Class Nbr: " + rItem["Class Nbr"];
  desc += "\\nSection: " + rItem["Section"];
  desc += "\\nInstructor: " + rItem["Instructor"];

  // Location
  location = rItem["Room"].split(/\s+/).join(" ");

  // DTSTAMP
  // format is YYYMMDDThhmmssZ
  dtstamp = new Date().toISOString().replace(/[-:]/g, "");
  dtstamp = dtstamp.replace(/\.\d{3}/, "");

  // DTSTART and DTEND and RRULE
  var seSplit = rItem["Start/End Date"].replace(/ - /, '/').split('/');
  var startDate = seSplit[2] + seSplit[0] + seSplit[1];
  var endDate   = seSplit[5] + seSplit[3] + seSplit[4];

  var recurring = startDate !== endDate;
  if (recurring) {
    // Regular recurring component
    var temp = createDtBounds(rItem["Days & Times"], startDate, endDate);
    rrule = createRRule(rItem["Days & Times"], startDate, endDate);
    dtstart = temp[0];
    dtend = temp[1];
  } else {
    // Midterm or Seminar or Lab
    var temp = createDtBounds(rItem["Days & Times"], startDate, endDate);
    dtstart = temp[0];
    dtend = temp[1];
  }

  // UID
  uid = dtstamp.replace(/[TZ]/g, "");
  uid += uidCounter;
  uid += "\@aruu.github.io";
  uidCounter++;

  // Sample VEVENT format

  // BEGIN:VEVENT
  // DTSTART;TZID=America/Toronto:20150415T143000
  // DTEND;TZID=America/Toronto:20150415T170000
  // RRULE:FREQ=WEEKLY;UNTIL=20150520T183000Z;BYDAY=WE
  // DTSTAMP:20150415T063712Z
  // UID:a6elgdb5paod2eajn8uehscbe4@google.com
  // CREATED:20150415T063702Z
  // DESCRIPTION:asdf\nasdf\nasdf\nasf
  // LAST-MODIFIED:20150415T063702Z
  // LOCATION:asd  as
  // SEQUENCE:0
  // STATUS:CONFIRMED
  // SUMMARY:asdfasdf
  // TRANSP:OPAQUE
  // END:VEVENT

  // BEGIN:VEVENT
  // DTSTART:20150414T153000Z
  // DTEND:20150414T180000Z
  // DTSTAMP:20150414T023441Z
  // UID:i5hiorj4c5k5jieieo19p8fet0@google.com
  // CREATED:20150414T023411Z
  // DESCRIPTION:desc\nasdf\nasdf
  // LAST-MODIFIED:20150414T023411Z
  // LOCATION:place
  // SEQUENCE:0
  // STATUS:CONFIRMED
  // SUMMARY:title
  // TRANSP:OPAQUE
  // END:VEVENT

  // Print to string
  var outputString = "";
  outputString += "BEGIN:VEVENT\n";
  outputString += "DTSTART;TZID=America/Toronto:" + dtstart + "\n";
  outputString += "DTEND;TZID=America/Toronto:" + dtend + "\n";
  if (recurring) outputString += "RRULE:" + rrule + "\n";
  outputString += "DTSTAMP:" + dtstamp + "\n";
  outputString += "UID:" + uid + "\n";
  // outputString += "CREATED:\n";
  outputString += "DESCRIPTION:" + desc + "\n";
  // outputString += "LAST-MODIFIED:\n";
  outputString += "LOCATION:" + location + "\n";
  // outputString += "SEQUENCE:0\n";
  // outputString += "STATUS:CONFIRMED\n";
  outputString += "SUMMARY:" + summary + "\n";
  // outputString += "TRANSP:OPAQUE\n";
  outputString += "END:VEVENT\n";
  return outputString;
}

function createRRule(daysTimes, startDate, endDate) {
  var rrule = "FREQ=WEEKLY;UNTIL=" + endDate + "T235959Z;BYDAY=";

  var daysChar = daysTimes.match(/\w+/)[0].match(/[MTWF]h?/g);
  var i = 0;
  if (daysChar[i] === "M") {
    rrule += "MO,";
    i++;
  }
  if (daysChar[i] === "T") {
    rrule += "TU,";
    i++;
  }
  if (daysChar[i] === "W") {
    rrule += "WE,";
    i++;
  }
  if (daysChar[i] === "Th") {
    rrule += "TH,";
    i++;
  }
  if (daysChar[i] === "F") {
    rrule += "FR,";
    i++;
  }

  return rrule.replace(/.$/,"");
}

function createDtBounds(daysTimes, startDate, endDate) {

  if (startDate !== endDate) {
    var daysChar = daysTimes.match(/\w+/)[0].match(/[MTWF]h?/g);
    switch (daysChar[0]) {
      case "T":
        startDate = (parseInt(startDate) + 1).toString();
        break;
      case "W":
        startDate = (parseInt(startDate) + 2).toString();
        break;
      case "Th":
        startDate = (parseInt(startDate) + 3).toString();
        break;
      case "F":
        startDate = (parseInt(startDate) + 4).toString();
    }
  }

  var pattern = /(\d+):(\d+)(\w+)/g;
  var aData = pattern.exec(daysTimes);
  var bData = pattern.exec(daysTimes);
  if (aData[3] === "PM" && aData[1] !== "12") {
    aData[1] = (parseInt(aData[1]) + 12).toString();
  }
  if (aData[3] === "AM" && aData[1] === "12") {
    aData[1] = "00";
  }
  if (bData[3] === "PM" && bData[1] !== "12") {
    bData[1] = (parseInt(bData[1]) + 12).toString();
  }
  if (bData[3] === "AM" && bData[1] === "12") {
    bData[1] = "00";
  }
  bData[2] = (parseInt(bData[2]) + 10).toString();
  if (bData[2] === "60") {
    bData[1] = (parseInt(bData[1]) + 1).toString();
    bData[2] = "00";
  }
  
  var a = aData[1] + aData[2] + "00";
  for (var i=a.length; i<6; i++) a = "0" + a;
  var b = bData[1] + bData[2] + "00";
  for (var i=b.length; i<6; i++) b = "0" + b;

  return [startDate+"T"+a, startDate+"T"+b];
}
