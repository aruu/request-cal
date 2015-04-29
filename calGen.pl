#!/usr/bin/perl
use strict;
use warnings;

my $file_name = "ctrla";
my $input_path = shift;
my $output_path = "output.ics";

open my $input_file, '<', $input_path
    or die "Error opening $input_path - $!\n";

open my $output_file, '>', $output_path
    or die "Error creating $output_path - $!\n";


# ICS file header
print $output_file "BEGIN:VCALENDAR\n";
print $output_file "VERSION:2.0\n";
print $output_file "PRODID:-//Kevin Thai//reQuestCal 1.0//EN\n";

my $numevents = 0;

# Iterate through Quest text
while (<$input_file>) {
  # Start of course info for one specific course
  if (/(\w+ \d+) - ([\w\- ]+)/) {
    # Start of course components info block
    my %row = (
      course_code => $1,
      course_name => $2,
      class_number => "",
      section => "",
      component => "",
      days_times => "",
      room => "",
      instructor => "",
      start_end => ""
    );

    # Skip 12 lines
    <$input_file> foreach (1..12);

    # Entries in each row
    $_ = <$input_file>;
    until (/\t/) { # Catch all rows
      $numevents += 1;
      read_row($input_file, \%row, $_);
      create_event($output_file, \%row);

      # Get next line
      $_ = <$input_file>;
    }
  }
}

# End ICS file
print $output_file "END:VCALENDAR\n";

print "The total number of events created was $numevents.\n";




# SUBROUTINES

# Parse the equivalent of a row of course component info and update data struct
sub read_row {
  my $input_file = shift;
  my $row_ref = shift;
  my $next_line = shift;

  unless ($next_line =~ /\ /) {
    # Regular row
    $$row_ref{class_number} = $next_line;
    <$input_file>;
    $$row_ref{section} = <$input_file>;
    <$input_file>;
    $$row_ref{component} = <$input_file>;
  } else {
    # Add'l line of same component
    <$input_file>;
    <$input_file>;
  }
  <$input_file>;
  $$row_ref{days_times} = <$input_file>;
  <$input_file>;
  $$row_ref{room} = <$input_file>;
  <$input_file>;
  $$row_ref{instructor} = <$input_file>;
  <$input_file>;
  $$row_ref{start_end} = <$input_file>;

  # Remove newlines
  chomp $$row_ref{$_} foreach (keys %$row_ref);
}

# Process the info and create event
sub create_event {
  my $output_file = shift;
  my $row_ref = shift;

  # Summary
  my $summary;
  if ($$row_ref{component} eq "LEC") {
    $summary = "$$row_ref{course_code} - $$row_ref{course_name}";
  } elsif ($$row_ref{component} eq "TST") {
    $summary = "$$row_ref{course_code} Midterm";
  } else {
    $summary = "$$row_ref{course_code} $$row_ref{component}";
  }

  # Description
  my $desc = "Class Nbr: $$row_ref{class_number}";
  $desc .= "\\nSection: $$row_ref{section}";
  $desc .= "\\nInstructor: $$row_ref{instructor}";

  # Location
  my $location = join(' ', split(/\s+/, $$row_ref{room}) );

  # DTSTAMP
  # format is YYYMMDDThhmmssZ
  my ($sec,$min,$hour,$mday,$mon,$year,$wday,$yday,$isdst) = gmtime();
  my $dtstamp = sprintf("%04d%02d%02dT%02d%02d%02dZ",
    $year+1900, $mon+1, $mday, $hour, $min, $sec);

  # Parse out Start and End dates
  my @out = $$row_ref{start_end} =~ /(\d+)\/(\d+)\/(\d+)/g;
  my $start_date = join('', ($out[2], $out[0], $out[1]));
  my $end_date   = join('', ($out[5], $out[3], $out[4]));

  # DTSTART and DTEND and RRULE
  my $recurring = ($start_date ne $end_date);
  my ($dtstart, $dtend, $rrule);
  if ($recurring) {
    # Regular recurring component
    ($dtstart, $dtend) = create_dtbounds($$row_ref{days_times}, $start_date, $end_date);
    $rrule             = create_rrule(   $$row_ref{days_times}, $start_date, $end_date);
  } else {
    # Midterm or Seminar or Lab
    ($dtstart, $dtend) = create_dtbounds($$row_ref{days_times}, $start_date, $end_date);
  }

  # UID
  my $uid = sprintf("%04d%02d%02d%02d%02d%02d", $year+1900, $mon+1, $mday, $hour, $min, $sec);;
  $uid .= sprintf("%d", int(rand(999999)));
  $uid .= "\@aruu.github.com";

  # Sample VEVENT format

  # BEGIN:VEVENT
  # DTSTART;TZID=America/Toronto:20150415T143000
  # DTEND;TZID=America/Toronto:20150415T170000
  # RRULE:FREQ=WEEKLY;UNTIL=20150520T183000Z;BYDAY=WE
  # DTSTAMP:20150415T063712Z
  # UID:a6elgdb5paod2eajn8uehscbe4@google.com
  # CREATED:20150415T063702Z
  # DESCRIPTION:asdf\nasdf\nasdf\nasf
  # LAST-MODIFIED:20150415T063702Z
  # LOCATION:asd  as
  # SEQUENCE:0
  # STATUS:CONFIRMED
  # SUMMARY:asdfasdf
  # TRANSP:OPAQUE
  # END:VEVENT

  # BEGIN:VEVENT
  # DTSTART:20150414T153000Z
  # DTEND:20150414T180000Z
  # DTSTAMP:20150414T023441Z
  # UID:i5hiorj4c5k5jieieo19p8fet0@google.com
  # CREATED:20150414T023411Z
  # DESCRIPTION:desc\nasdf\nasdf
  # LAST-MODIFIED:20150414T023411Z
  # LOCATION:place
  # SEQUENCE:0
  # STATUS:CONFIRMED
  # SUMMARY:title
  # TRANSP:OPAQUE
  # END:VEVENT

  # Print to .ICS file
  print $output_file "BEGIN:VEVENT\n";
  print $output_file "DTSTART;TZID=America/Toronto:$dtstart\n";
  print $output_file "DTEND;TZID=America/Toronto:$dtend\n";
  print $output_file "RRULE:$rrule\n" if $recurring;
  print $output_file "DTSTAMP:$dtstamp\n";
  print $output_file "UID:$uid\n";
  # print $output_file "CREATED:\n";
  print $output_file "DESCRIPTION:$desc\n";
  # print $output_file "LAST-MODIFIED:\n";
  print $output_file "LOCATION:$location\n";
  # print $output_file "SEQUENCE:0\n";
  # print $output_file "STATUS:CONFIRMED\n";
  print $output_file "SUMMARY:$summary\n";
  # print $output_file "TRANSP:OPAQUE\n";
  print $output_file "END:VEVENT\n";
}

sub create_rrule {
  my $days_times = shift;
  my $start_date = shift;
  my $end_date = shift;

  my $rrule = sprintf("FREQ=WEEKLY;UNTIL=%sT200000Z;BYDAY=", $end_date);

  $days_times =~ /(\w+)/;
  my @days_chars = split(//, $1);
  my $toccur = 0;
  foreach my $ch (@days_chars) {
  if ($ch eq 'M') {
    $rrule .= "MO,";
  } elsif ($ch eq 'T') {
    $rrule .= "TU," if $toccur;
    $toccur = 1;
  } elsif ($ch eq 'W') {
    $rrule .= "TU," if $toccur;
    $toccur = 0;
    $rrule .= "WE,";
  } elsif ($ch eq 'h') {
    $toccur = 0;
    $rrule .= "TH,";
  } elsif ($ch eq 'F') {
    $rrule .= "TU," if $toccur;
    $toccur = 0;
    $rrule .= "FR,";
  }
  }
  $rrule .= "TU," if $toccur;
  chop $rrule;

  return $rrule;
}

sub create_dtbounds {
  my $days_times = shift;
  my $start_date = shift;
  my $end_date = shift;

  if ($start_date ne $end_date) {
    # Determine date of first occurrence,
    #   start date given is the first day of classes, Monday
    $days_times =~ /(\w+)/;
    my @days_chars = split(//, $1);
    my $daystr = '';
    my $toccur = 0;
    foreach my $ch (@days_chars) {
    if ($ch eq 'M') {
      $daystr .= "0";
    } elsif ($ch eq 'T') {
      $daystr .= "1" if $toccur;
      $toccur = 1;
    } elsif ($ch eq 'W') {
      $daystr .= "1" if $toccur;
      $toccur = 0;
      $daystr .= "2";
    } elsif ($ch eq 'h') {
      $toccur = 0;
      $daystr .= "3";
    } elsif ($ch eq 'F') {
      $daystr .= "1" if $toccur;
      $toccur = 0;
      $daystr .= "4";
    }
    }
    $daystr .= "1" if $toccur;
    $start_date += substr($daystr, 0, 1);
  }

  my @t = $days_times =~ /(\d+):(\d+)(\w+)/g;
  my ($a, $b);
  $t[0] += 12 if ($t[2] eq "PM" and $t[0] != 12);
  $a = sprintf("%02d%02d00", $t[0], $t[1]);
  $t[3] += 12 if ($t[5] eq "PM" and $t[3] != 12);
  # Have events ending at HH:30 and HH:00
  $t[4] += 10;
  if ($t[4] == 60) {
    $t[3] += 1;
    $t[4] = 0;
  }
  $b = sprintf("%02d%02d00", $t[3], $t[4]);

  my $dtstart = sprintf("%sT%06d", $start_date, $a);
  my $dtend   = sprintf("%sT%06d", $start_date, $b);

  return ($dtstart, $dtend);
}