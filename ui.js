var areas = [
  { name: "Stability", lead: "dmajor" },
  { name: "Data Collection", lead: "bsmedberg" },
  { name: "Data Reporting", lead: "rvitillo" },
  { name: "Plugins", lead: "gfritzsche" },
  { name: "Install & Update", lead: "rstrong" },
  { name: "Media Plugins", lead: "rstrong" },
  { name: "Windows Stuff", lead: "tim" },
  { name: "Mac Stuff", lead: "smichaud" },
  { name: "Sandbox-Win", lead: "tim" },
  { name: "Sandbox-Mac", lead: "areinald" },
  { name: "Startup/Rloop/Shutdown", lead: "bsmedberg" },
  { name: "Power", lead: "rvitillo" },
  { name: "Perf. Tests", lead: "vladan" },
  { name: "Other", lead: "bsmedberg" },
];

var states = [
  "Complete",
  "Uplift",
  "Review",
  "Coding",
  "Investigation",
  "P1",
  "P2",
  "P3",
  "Triage",
];

var items = [
  {
    area: 0,
    state: "Investigation",
    summary: "about:memory",
  },
  {
    area: 0,
    state: "Investigation",
    summary: "nptnt2.dll",
  },
];

function setup() {
  var headRow = $("#mainTable thead tr");
  areas.forEach(function(area) {
    headRow.append($('<th class="area-head ui-widget-header">').text(area.name).data("area", area));
  });
  var tbody = $("#mainTable tbody");
  var targetRow = $('<tr>');
  areas.forEach(function(area, i) {
    targetRow.append($('<td class="plist">').data("area_n", i));
  });
  states.forEach(function(state) {
    var c = $('<th class="status-row">').attr("colspan", areas.length).text(state);
    tbody.append($('<tr>').append(c));
    tbody.append(targetRow.clone(true).data("state", state));
  });
  items.forEach(function(item) {
    var r = $("#mainTable tbody tr").filter(function(i, el) {
      return $(el).data("state") == item.state;
    });
    var c = $(".plist", r).filter(function(i, el) {
      return $(el).data("area_n") == item.area;
    });
    c.append($('<div class="item">').text(item.summary).data("item", item));
  });

  $(".plist").sortable({
    connectWith: ".plist",
    placeholder: "plist-placeholder",
    forcePlaceholderSize: true,
  }).disableSelection();

  $(document).tooltip({
    items: ".area-head",
    content: function() {
      var e = $(this);
      var area = e.data("area");
      return "Tech lead: " + area.lead;
    },
  });
  $("#itemForm").dialog({
    autoOpen: false,
  });
  $(document).on("click", ".item", function() {
    var item = $(this).data("item");
    $("#itemBug").val(item.bug);
    $("#itemSync").val(item.sync);
    $("#itemSummary").val(item.summary);
    $("#itemOwner").val(item.owner);
    var form = $("#itemForm");
    form.dialog("option", "position", { my: "left", at: "right+10", of: this }).dialog("open");
  });
}
setup();
