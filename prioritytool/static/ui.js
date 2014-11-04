var kAPI = 'api/';
var kBugzilla = 'https://bugzilla.mozilla.org/rest/';
var gData;
var gCurrentItem;
var gPending = false;
var gUntriagedRow;

function cancelItem() {
  if (gCurrentItem.id) {
    return;
  }
  gCurrentItem._node.remove();
}

function findStage(priority) {
  var stage = gData.stages[0];
  for (var i = 0; i < gData.stages.length; ++i) {
    if (priority < gData.stages[i].priority) {
      break;
    }
    stage = gData.stages[i];
  }
  return stage;
}

function findListForItem(item) {
  var stageRow;
  if (item.priority === null) {
    stageRow = gUntriagedRow;
  } else {
    stageRow = findStage(item.priority)._row;
  }
  var candidates = $(".plist", stageRow);
  var list = candidates.filter(function() { return $(this).data("area_id") == item.area; });
  if (list.size()) {
    return list;
  }
  return candidates.last();
}

function insertItemInList(item) {
  var list = findListForItem(item);
  var items = $('.item', list);
  var found = false;
  items.each(function() {
    if (found) {
      return;
    }
    if (item.priority < $(this).data("item").priority) {
      $(this).before(item._node);
      found = true;
    }
  });
  if (!found) {
    list.append(item._node);
  }
}

function postFormData(url, fd) {
  return new Promise(function(resolve, reject) {
    var req = new XMLHttpRequest();
    req.open("POST", url);
    req.timeout = 60 * 1000;
    req.onreadystatechange = function() {
      if (req.readyState != req.DONE) {
        return;
      }
      if (req.status == 200) {
        resolve(req.responseText);
      } else {
        reject(Error("Bad Response: " + req.status + ": " + req.responseText));
      }
    };
    req.send(fd);
  });
}

function saveNewItem(item) {
  var fd = new FormData();
  ["area", "priority", "bugid", "bugsync", "summary", "owner", "notes"].forEach(function(p) {
    var v = item[p];
    if (v === null) {
      v = "";
    }
    fd.append(p, v);
  });
  return postFormData(kAPI + "write/new", fd).then(function(response) { return parseInt(response); });
}

function saveUpdates(id, updates) {
  if (!updates.length) {
    return Promise.resolve();
  }
  var fd = new FormData();
  updates.forEach(function(u) {
    var v = u.value;
    if (v === null) {
      v = "";
    }
    fd.append(u.key, v);
  });
  return postFormData(kAPI + "write/update/" + id, fd);
}

function saveItem() {
  var p, changes;
  if (gCurrentItem.id) {
    changes = [];
    p = function(key, value) {
      if (gCurrentItem[key] != value) {
        changes.push({key: key, value: value});
      }
    };
  } else {
    p = function(key, value) {
      gCurrentItem[key] = value;
    };
  }

  p("bugid", $("#itemBug").val());
  p("bugsync", $("#itemSync").prop("checked"));
  p("summary", $("#itemSummary").val());
  p("owner", $("#itemOwner").val());
  p("notes", $("#itemNotes").val());

  if (gCurrentItem.id) {
    return saveUpdates(gCurrentItem.id, changes).then(function() {
      changes.forEach(function(i) {
        gCurrentItem[i.key] = i.value;
      });
      updateItemNode(gCurrentItem);
    });
  }

  return saveNewItem(gCurrentItem).then(
    function(id) {
      gCurrentItem.id = id;
      gData.projects.push(gCurrentItem);
      updateItemNode(gCurrentItem);
    });
}

var gItemTemplate = $('<div class="item"><div class="item-summary"></div><div><a class="item-bugid"></a> - <span class="item-owner"></span></div>');

function updateItemNode(item) {
  $(".item-summary", item._node).text(item.summary || "(no summary)");
  $(".item-bugid", item._node).text(item.bugid).attr("href", "https://bugzilla.mozilla.org/show_bug.cgi?id=" + item.bugid);
  $(".item-owner", item._node).text(item.owner || "(unowned)");
}

function createItemNode(item) {
  var i = gItemTemplate.clone();
  i.data("item", item);
  item._node = i.get(0);
  updateItemNode(item);
  return i;
}

function midPoint(a, b) {
  return (a + b) / 2;
}

function beginningOfStage(stage) {
  return stage.priority;
}

function endOfStage(stage) {
  var idx = gData.stages.indexOf(stage);
  if (idx + 1 == gData.stages.length) {
    return stage.priority + 10;
  }
  return gData.stages[idx + 1].priority;
}

var gCurrentSync;
function syncCurrent() {
  var bugid = $("#itemBug").val();
  if (bugid == "") {
    return;
  }
  bugid = parseInt(bugid);
  var xhr = new XMLHttpRequest();
  xhr.open("GET", kBugzilla + "bug/" + bugid);
  xhr.setRequestHeader("Accept", "application/json");
  xhr.onload = function() {
    if (gCurrentSync != xhr) {
      return;
    }
    if (xhr.status != 200) {
      return;
    }
    var d = JSON.parse(xhr.responseText);
    if (d.error) {
      return;
    }
    var bug = d.bugs[0];
    $("#itemSummary").val(bug.summary);
    var owner = bug.assigned_to;
    if (owner == "nobody@mozilla.org") {
      owner = '';
    } else if (owner in gData.aliases) {
      owner = gData.alises[owner];
    }
    $("#itemOwner").val(owner);
  };
  gCurrentSync = xhr;
  xhr.send();
}

function start() {
  $("#itemSyncNow").on("click", syncCurrent);
  $("#itemProgressBar").progressbar({value: false}).hide();
  $("#itemForm").dialog({
    dialogClass: "item-form-dialog",
    autoOpen: false,
    open: function() {
      if (gPending) {
        throw Error("Shouldn't open while pending");
      }
      gCurrentSync = null;
      $(".item.current").toggleClass("current", false);
      $("#itemProgressBar").hide();
      $(gCurrentItem._node).toggleClass("current", true);
      if (gCurrentItem.id) {
        var summary = gCurrentItem.summary;
        if (!summary) {
          summary = "(no summary)";
        }
        $(this).dialog("option", "title", gCurrentItem.id + ": " + summary);
      } else {
        $(this).dialog("option", "title", "New");
      }
      $("#itemBug").val(gCurrentItem.bugid);
      $("#itemSync").prop("checked", gCurrentItem.bugsync);
      $("#itemSummary").val(gCurrentItem.summary);
      $("#itemOwner").val(gCurrentItem.owner);
      $("#itemNotes").val(gCurrentItem.notes);
    },
    beforeClose: function() {
      if (gPending) {
        return false;
      }
      return true;
    },
    close: function() {
      if (gCurrentItem) {
        cancelItem();
        gCurrentItem = null;
      }
      $(".item.current").toggleClass("current", false);
     },
    buttons: [
      {
        text: "Cancel",
        click: function() {
          $(this).dialog("close");
        }
      },
      {
        text: "Done",
        click: function() {
          $("#itemProgressBar").show();
          gPending = true;
          saveItem().then(
            function() {
              gPending = false;
              gCurrentItem = null;
              $("#itemForm").dialog("close");
            },
            function(err) {
              gPending = false;
              $("#itemProgressBar").hide();
              $("#errorDialog").dialog({modal: true}).text(err);
            });
        }
      },
    ],
  });
  $("#itemForm").on("keypress", "input", function(e) {
    if (e.which == 13) {
      $("#itemForm").dialog("option", "buttons")[1].click();
    }
  });

  $("#loadProgress").progressbar({value: false});
  $.getJSON(kAPI + "load", function(d) {
    gData = d;
    setupData();
  });
}

function setupData() {
  var headRow = $("#mainTable thead tr");
  var targetRow = $('<tr class="stage-plists">');
  gData.areas.forEach(function(area) {
    headRow.append($('<th class="area-head ui-widget-header">').text(area.name).data("area", area));
    targetRow.append($('<td class="plist">').data("area_id", area.id));
  });
  headRow.append($('<th class="ui-widget-header">').text("Other"));
  targetRow.append($('<td class="plist">').data("area_id", null));
  var tbody = $("#mainTable tbody");
  var c = $('<th class="stage-head">').attr("colspan", gData.areas.length + 1).text("Complete");
  tbody.append($('<tr class="stage-plists">').append(c));
  tbody.append(targetRow.clone(true).data("stage", "complete"));
  gData.stages.forEach(function(stage) {
    var c = $('<th class="stage-head">').attr("colspan", gData.areas.length + 1).text(stage.name);
    tbody.append($('<tr>').append(c));
    var row = targetRow.clone(true).data("stage", stage);
    tbody.append(row);
    stage._row = row;
  });
  c = $('<th class="stage-head">').attr("colspan", gData.areas.length + 1).text("Untriaged");
  tbody.append($('<tr class="stage-plists">').data("stage", "untriaged").append(c));
  gUntriagedRow = targetRow.clone(true).data("stage", "untriaged");
  tbody.append(gUntriagedRow);

  $(".plist").sortable({
    connectWith: ".plist",
    placeholder: "plist-placeholder",
    forcePlaceholderSize: true,
    update: function(e, ui) {
      if ($(this).find(ui.item).size() == 0) {
        return;
      }
      var item = ui.item.data("item");
      var stage = $(this).closest(".stage-plists").data("stage");
      var changes = [];
      if (stage == "complete") {
        changes.push({key: "complete", value: true});
      } else {
        if (item.complete) {
          changes.push({key: "complete", value: false});
        }
        var priority;
        if (stage == "untriaged") {
          priority = null;
        } else {
          var ppriority, npriority;
          var p = ui.item.prev(".item");
          if (p.size()) {
            ppriority = p.data("item").priority;
          } else {
            ppriority = beginningOfStage($(this).closest(".stage-plists").data("stage"));
          }
          var n = ui.item.next(".item");
          if (n.size()) {
            npriority = n.data("item").priority;
          } else {
            npriority = endOfStage($(this).closest(".stage-plists").data("stage"));
          }
          priority = midPoint(ppriority, npriority);
        }
        if (item.priority !== priority) {
          changes.push({key: "priority", value: priority});
        }
      }
      var newArea = $(this).data("area_id");
      if (newArea != item.area) {
        changes.push({key: "area", value: newArea});
      }
      saveUpdates(item.id, changes).then(
        function() {
          changes.forEach(function(c) {
            item[c.key] = c.value;
          });
        },
        function(err) {
          $("#errorDialog").dialog({modal: true}).text(err);
        });
    },
  }).disableSelection();

  gData.projects.forEach(function(item) {
    createItemNode(item);
    insertItemInList(item);
  });

  $(document).tooltip({
    items: ".area-head",
    content: function() {
      var e = $(this);
      var area = e.data("area");
      return "Tech lead: " + area.lead;
    },
  });
  $(document).on("click", ".item", function() {
    if (gPending) {
      return;
    }
    gCurrentItem = $(this).data("item");
    var form = $("#itemForm");
    form.dialog("option", "position", { my: "left top-10", at: "right+10 center", of: this })
        .dialog("open");
  });

  $("#loadProgress").progressbar("destroy");
  $("#loadProgress").remove();
  $("#mainTable").toggleClass("invisible", false);

  $(document).on("click", ".plist", function(e) {
    if (e.currentTarget != e.target) {
      return;
    }
    if (gPending) {
      return;
    }

    var stage = $(this).closest(".stage-plists").data("stage");
    if (stage == "complete") {
      return;
    }

    var priority = null;
    if (stage != "untriaged") {
      var lastPriority = beginningOfStage(stage);
      var lastItem = $('.item', this).last();
      if (lastItem.size()) {
        lastPriority = lastItem.data("item").priority;
      }
      priority = midPoint(lastPriority, endOfStage(stage));
    }
    var item = {
      id: null,
      area: $(this).data("area_id"),
      priority: priority,
      bugid: null,
      bugsync: true,
      summary: "",
      owner: null,
      notes: "",
      complete: false,
    };
    var node = createItemNode(item);
    $(this).append(node);
    gCurrentItem = item;
    $("#itemForm").dialog("option", "position", { my: "left top-10", at: "right+10 center", of: this }).dialog("open");
  });
}
start();
