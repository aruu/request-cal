var uidCounter = 0;

function generateICS() {
  var input = document.getElementById("quest_content").value;

  var output = "";

  // ICS file header
  output += "BEGIN:VCALENDAR\n";
  output += "VERSION:2.0\n";
  output += "PRODID:-//Kevin Thai//reQuestCal 1.5//EN\n";

  var numEvents = 0;

  // Clean up input text
  input = input.split("\n");
  for (var i=input.length-1; i>=0; i--) {
    if (/^\t*$/.exec(input[i])) input.splice(i,1);
  }

  var rows = [];

  // Iterate through Quest text
  for (var i=0; i<input.length; i++) {

    if (result = /(\w+ \d+\w*) - ([\w\-&\. ]+)/.exec(input[i])) {
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

      // Start of component data
      // Entries in each row
      while (input[i] !== "Exam Information") {
        numEvents++;
        row = readRow(row, input, i, colNames);
        // var tempRow =  {};
        // for (var key in row) tempRow[key] = row[key];
        rows.push(row);
        i += colNames.length;
      }

    }

  }
  console.log(rows);
  // processRows(rows);
  // console.log(rows);
  
  // for (var i=0; i<rows.length; i++) {
  //   console.log(rows[i]);
  //   if (rows[i]["Days & Times"] !== undefined && rows[i]["Days & Times"] !== "TBA" && rows[i]["Days & Times"] !== " ") {
  //     output += createEvent(rows[i]);
  //   }
  // }

  // End ICS file
  output += "END:VCALENDAR\n";

  document.getElementById("ics_content").value = output;

  // Exporting to file?
  var aasdf = document.createElement("a");
  var file = new Blob([output], {type: 'data:text/ics;charset=utf-8'});
  aasdf.href = URL.createObjectURL(file);
  aasdf.download = "asdf.ics";
  document.body.appendChild(aasdf);
  // aasdf.click();

  var info = "The total number of events created was " + numEvents + ".";
}

// Produce a struct with fields named with column headers
function readRow(row, input, i, colNames) {
  // we've already stripped out all lines that are just tab;
  // every other space should be an empty cell
  for (var j=0; j<colNames.length; j++) {
    if (input[i+j].match(/^[\t\s]*$/)) continue;
    row[colNames[j]] = input[i+j];
  }
  return row;
}

function createEvent(r) {
	var summary, desc, location, dtstamp, dtstart, dtend, rrule, uid;

  // Summary
  switch (r.component) {
    case "LEC":
    summary = document.getElementById("lec_format").value;
    break;
    case "TUT":
    summary = document.getElementById("tut_format").value;
    break;
    case "LAB":
    summary = document.getElementById("lab_format").value;
    break;
    case "TST":
    summary = document.getElementById("tst_format").value;
    break;
    case "SEM":
    summary = document.getElementById("sem_format").value;
    break;
    case "PRJ":
    summary = document.getElementById("prj_format").value;
  }
  if (summary === "" || summary === undefined) {
    summary = document.getElementById("dft_format").value;
  }
  // Process substitutions
  summary = summary.split("\\\\");
  for (var i=0; i<summary.length; i++) {
    var temp = summary[i];
    temp = temp.replace(/([^\\]|^)%cc/g, "$1" + r.courseCode);
    temp = temp.replace(/\\%cc/g, "%cc");
    temp = temp.replace(/([^\\]|^)%cn/g, "$1" + r.courseName);
    temp = temp.replace(/\\%cn/g, "%cn");
    temp = temp.replace(/([^\\]|^)%comp/g, "$1" + r.component);
    summary[i] = temp.replace(/\\%comp/g, "%comp");
  }
  summary = summary.join("\\");

  // Description
  desc = "Class Nbr: " + r.classNumber;
  desc += "\\nSection: " + r.section;
  desc += "\\nInstructor: " + r.instructor;

  // Location
  location = r.room.split(/\s+/).join(" ");

  // DTSTAMP
  // format is YYYMMDDThhmmssZ
  dtstamp = new Date().toISOString().replace(/[-:]/g, "");
  dtstamp = dtstamp.replace(/\.\d{3}/, "");

  // DTSTART and DTEND and RRULE
  var seSplit = r.startEnd.replace(/ - /, '/').split('/');
  var startDate = seSplit[2] + seSplit[0] + seSplit[1];
  var endDate   = seSplit[5] + seSplit[3] + seSplit[4];

  var recurring = startDate !== endDate;
  if (recurring) {
    // Regular recurring component
    var temp = createDtBounds(r.daysTimes, startDate, endDate);
    rrule = createRRule(r.daysTimes, startDate, endDate);
    dtstart = temp[0];
    dtend = temp[1];
  } else {
    // Midterm or Seminar or Lab
    var temp = createDtBounds(r.daysTimes, startDate, endDate);
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
