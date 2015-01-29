(function() {

  // data visualization (*no data manipulation* in codes below)
  // build up skeleton for rendering
  var selector = d3.select("#progress"),
    svgSide = selector[0][0].offsetWidth,
    r = svgSide * 4 / 9,
    bandWidth = r / 4;

  // init responsive svg
  var rootG = selector.append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", "0 0 " + svgSide + " " + svgSide)
    .attr("preserveAspectRatio", "xMinYMin")
    .append("g")
    .attr("transform", "translate(" + svgSide / 2 + "," + svgSide / 2 + ")");

  // init an equally segmented pie layout
  var pie = d3.layout.pie()
    .value(function() {
      return 1;
    });

  // color scale for peer comparison
  var color = d3.scale.linear()
    .domain([-1, 0, 1])
    .range(["#D9321D", "#FFF", "#45D91D"]);

  // init default report group
  var defaultReportG = rootG.append("g")
    .attr("class", "default-report");

  // clickable area and help text for going back
  var backG = rootG.append("g")
    .attr("class", "go-back");
  backG.append("circle")
    .attr("r", r - bandWidth)
    .attr("opacity", 0);
  var helpText = backG.append("text")
    .attr("transform", "translate(0," + (-bandWidth * 2.5) + ")")
    .attr("opacity", 0)
    .text("<");

  d3.json("_courseStructure.json", function(structure) {
    d3.json("_students.json", function(data) {

      // add some helper methods for data objects
      structure.getParent = function(label) {
        return this[category].parent[label];
      };

      structure.getChildren = function(label) {
        return this[category].children[label];
      };

      structure.checkThenRun = function(label) {
        // if label is a possible level, then run nextstep function, else then do nothing
        if (label in this[category].children) {
          return function(nextstep) {
            return nextstep(label);
          };
        } else {
          return function(nextstep) {};
        }
      };

      data.IDs = Object.keys(data);

      data.getAvgData = function() {
        return this.avg[category];
      };

      data.getStudentData = function(id) {
        return id ? this[id][category] : this[499][category];
      };

      // init selectbox for student
      d3.select("#select-student")
        .selectAll("option")
        .data(data.IDs)
        .enter()
        .append("option")
        .attr("value", function(d) {
          return d;
        })
        .text(function(d) {
          return d;
        });

      var category = d3.select("#select-category").property("value");
      var student_id = d3.select("#select-student").property("value");
      var studentData = data.getStudentData(student_id);
      var avgData = data.getAvgData();

      // rendering starts from 'overall' level
      render("overall");

      function render(label) {

        var donut = studentData.donut[label];
        var donutAvg = avgData.donut[label];
        var report = studentData.report[label];
        var reportAvg = avgData.report[label];

        var durationNormal = 1000;
        var durationShort = durationNormal / 2;

        // if donut is array then generate default report, else then clear chart
        if (donut && donut.constructor === Array) {
          // remove old report
          defaultReportG.selectAll("text").remove();
          // default report - title
          defaultReportG.append("text")
            .attr("transform", "translate(0," + (-bandWidth * 1.5) + ")")
            .attr("class", "report-title")
            .text(label.toUpperCase());
          // default report - percentage (for both exercise and video)
          defaultReportG.append("text")
            .attr("class", "percentage")
            .classed("category-" + category, true)
            .call(percentageAnimated, report);
          // default report - peer comparison
          var diff = report - reportAvg;
          defaultReportG.append("text")
            .attr("class", "report-comparison")
            .text(generateComparisonText(diff))
            .attr("fill", color(darkerRange(diff)))
            .call(slideOut, "0," + bandWidth * 1.5);
        } else {
          donut = [];
        }

        // init arc groups
        var arcs = rootG.selectAll(".arc")
          .data(pie(donut)); // get angles from pie layout
        arcs.enter()
          .append("g")
          .attr("class", "arc");

        // background arcs
        var arcBG = d3.svg.arc()
          .innerRadius(r - bandWidth)
          .outerRadius(r);
        arcs.append("path")
          .attr("class", "arc-bg")
          .attr("d", arcBG);

        // foreground arcs for visualize current progress
        var arcFG = d3.svg.arc()
          .innerRadius(function(d) {
            return r - d.data * bandWidth;
          })
          .outerRadius(r);
        arcs.append("path")
          .attr("class", "arc-fg")
          .classed("category-" + category, true)
          // foreground arcs transite from outerRadius to innerRadius
          .attr("d", d3.svg.arc()
            .innerRadius(r)
            .outerRadius(r))
          .transition()
          .duration(durationNormal)
          .attrTween("d", function(d) {
            var dStart = JSON.parse(JSON.stringify(d));
            d.data = 0;
            var i = d3.interpolateObject(d, dStart);
            return function(t) {
              return arcFG(i(t));
            };
          });

        // colored outer arcs for peer comparison
        var arcComparison = d3.svg.arc()
          .innerRadius(r)
          .outerRadius(r + bandWidth * 0.1);
        arcs.append("path")
          .attr("class", "arc-comparison")
          .attr("opacity", 0)
          .attr("fill", function(d, i) {
            return color(darkerRange(d.data - donutAvg[i]));
          })
          .attr("d", arcComparison);

        // arc report
        arcs.append("text")
          .call(hideToArcCentroid)
          .attr("class", "report-title")
          .text(function(d, i) {
            return structure.getChildren(label)[i].toUpperCase();
          });
        // arc report - percentage
        arcs.append("text")
          .call(hideToArcCentroid) //"translate(0,0)"
          .attr("class", "percentage")
          .classed("category-" + category, true)
          .text(function(d) {
            return valToPercentString(d.data);
          });
        // arc report - peer comparison
        arcs.append("text")
          .call(hideToArcCentroid)
          .attr("class", "report-comparison")
          .attr("fill", function(d, i) {
            return color(darkerRange(d.data - donutAvg[i]));
          })
          .text(function(d, i) {
            return generateComparisonText(d.data - donutAvg[i]);
          });

        // clear old data
        arcs.exit().remove();

        // rerender when chart options change
        d3.select("#select-category").on("change", function() {
          category = this.value;
          studentData = data.getStudentData(student_id);
          avgData = data.getAvgData();
          update(label);
        });
        d3.select("#select-student").on("change", function() {
          student_id = this.value;
          studentData = data.getStudentData(student_id);
          avgData = data.getAvgData();
          update(label);
        });

        // show corresponding report & highlight hovered arc when hovering an arc *path*
        arcs
          .on("mouseover", function() {
            arcHover(this, 0.7, 0, 1);
          })
          .on("mouseout", function() {
            arcHover(this, 1, 1, 0);
          });

        // postpone mouseover events after default-report transition
        arcs.attr('pointer-events', 'none')
          .transition()
          .duration(durationNormal + durationShort * 1.5)
          .transition()
          .attr('pointer-events', 'auto');

        // zoom in when clicking an arc
        arcs.on("click", function(d, i) {
          structure.checkThenRun(structure.getChildren(label)[i])(update);
        });

        // show help text for going back when hovering inner circle and being able to go back
        backG.on("mouseover", function() {
            structure.checkThenRun(structure.getParent(label))(showHelpText);
          })
          .on("mouseout", hideHelpText);

        // zoom out when clicking inner circle
        backG.on("click", function() {
          structure.checkThenRun(structure.getParent(label))(update);
        });

        // animation helpers
        function percentageAnimated(selection, val) {
          selection.text("0%")
            .transition()
            .duration(durationNormal)
            .tween("text", function() {
              var i = d3.interpolate(0, val);
              return function(t) {
                this.textContent = valToPercentString(i(t));
              };
            });
        }

        function slideOut(selection, translation) {
          selection.attr("opacity", 0)
            .transition()
            .delay(durationNormal)
            .duration(durationShort)
            .attr("transform", "translate(" + translation + ")")
            .attr("opacity", 1);
        }

        function hideToArcCentroid(selection) {
          selection.attr("transform", function(d) {
              var xy = arcBG.centroid(d);
              return "translate(" + xy[0] + "," + xy[1] + ") " + "scale(0.1)";
            })
            .attr("opacity", 0);
        }

        function hideToArcCentroidAnimated(selection) {
          selection.transition()
            .duration(durationShort)
            .call(hideToArcCentroid);
        }

        function showArcReport(selection, translation) {
          selection.transition()
            .duration(durationShort)
            .attr("transform", "translate(" + translation + ") " + "scale(1)")
            .attr("opacity", 1);
        }

        function arcHover(arcNode, opacityArc, opacityDefaultReport, opacityArcReport) {
          var currentSelector = d3.select(arcNode).attr("opacity", opacityArc);
          currentSelector.select(".arc-comparison").attr("opacity", opacityArcReport);
          defaultReportG.selectAll("text")
            .transition()
            .duration(durationShort)
            .attr("opacity", opacityDefaultReport);
          if (opacityArcReport === 1) {
            currentSelector.select(".report-title")
              .call(showArcReport, "0," + (bandWidth * -1.5));
            currentSelector.select(".report-comparison")
              .call(showArcReport, "0," + (bandWidth * 1.5));
            currentSelector.select(".percentage")
              .call(showArcReport, "0,0");
          } else {
            currentSelector.selectAll("text")
              .call(hideToArcCentroidAnimated);
          }
        }

      }

      // helpers
      function update(label) {
        render(null); // clean previous data to avoid data collision
        render(label);
        if (label === "overall") {
          hideHelpText();
        }
      }

      function hideHelpText() {
        return helpText.attr("opacity", 0);
      }

      function showHelpText() {
        return helpText.attr("opacity", 0.2);
      }

      function valToPercentString(val) {
        return Math.abs(Math.floor(val * 100)) + "%";
      }

      function generateComparisonText(val) {
        return val >= 0 ? valToPercentString(val) + " ahead of peers" : valToPercentString(val) + " behind peers";
      }

      function darkerRange(val) {
        return val >= 0 ? val / 2 + 0.5 : val / 2 - 0.5;
      }

    });
  });

})();
