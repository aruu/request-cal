function toggle_messege(id) {
  console.log(document.getElementById(id).style.display);
  if (document.getElementById(id).style.display == '') {
    document.getElementById(id).style.display = 'none';
  } else {
    document.getElementById(id).style.display = '';
  }
}