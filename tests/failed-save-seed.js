module.exports = function (d) {
  d.getElementById("cName").value = "monsoon";
  d.getElementById("cDetail").value = "a season of rain";
  /* the "keep" button only saves once a card has been built, and in the page it comes BEFORE the build
   * button, so without this the harness clicks keep on an empty state and finds nothing to test */
  d.getElementById("cBuild").click();
};
