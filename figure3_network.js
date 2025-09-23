const tooltip = d3.select("#tooltip");

// Rotation parameter - set to 35 degrees
const ROTATION_ANGLE = 55;
// Zoom parameter - set to 1.2 (120% zoom)
const ZOOM_FACTOR = 0.9;

Promise.all([
  d3.csv("WW01_node.csv"),
  d3.csv("WW01_pipe.csv")
]).then(([nodes, edges]) => {
  const svg = d3.select("#chart");
  const width = +svg.attr("width");
  const height = +svg.attr("height");
  const margin = {top: 40, right: 80, bottom: 60, left: 60};
  
  // Add custom background image
  const defs = svg.append("defs");
  
  // Create a pattern for the background image
  const pattern = defs.append("pattern")
    .attr("id", "backgroundImage")
    .attr("patternUnits", "userSpaceOnUse")
    .attr("width", width)
    .attr("height", height);
  
  // Add the background image
  pattern.append("image")
    .attr("xlink:href", "figure_png/sample_img.jpg")
    .attr("width", width)
    .attr("height", height)
    .attr("preserveAspectRatio", "xMidYMid slice");
  
  // Add semi-transparent overlay to ensure readability
  pattern.append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "rgba(255, 255, 255, 0.3)");
  
  // Add background rectangle with image pattern
  svg.append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "url(#backgroundImage)");
  
  // Add chart title
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", 25)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .style("font-weight", "bold")
    .style("fill", "#2c3e50")
    .text(`Campus Sewer Network Graph Structure (Rotated ${ROTATION_ANGLE}°, Zoom ${(ZOOM_FACTOR * 100).toFixed(0)}%)`);
  
  // Create main group for better organization with rotation and zoom applied
  const g = svg.append("g")
    .attr("transform", `translate(${width/2},${height/2}) scale(${ZOOM_FACTOR}) rotate(${ROTATION_ANGLE}) translate(${-width/2 + margin.left},${-height/2 + margin.top})`);
  
  // Create separate group for legend that doesn't rotate or zoom
  const legendGroup = svg.append("g");
  
  // Adjusted scales with margins
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  
  const padding = 20;
  const minNodeDistance = 25; // Minimum distance between nodes in pixels

  const xScale = d3.scaleLinear()
    .domain(d3.extent(nodes, d => +d["X-Coordinate"]))
    .range([padding, innerWidth - padding]);

  const yScale = d3.scaleLinear()
    .domain(d3.extent(nodes, d => +d["Y-Coordinate"]))
    .range([padding, innerHeight - padding]);

  // Function to detect and resolve node overlaps
  function resolveNodeOverlaps(nodes) {
    const nodePositions = nodes.map(d => ({
      id: d["Node ID"],
      x: xScale(+d["X-Coordinate"]),
      y: yScale(+d["Y-Coordinate"]),
      originalX: xScale(+d["X-Coordinate"]),
      originalY: yScale(+d["Y-Coordinate"]),
      data: d
    }));
    
    // Simple force-based overlap resolution
    for (let iteration = 0; iteration < 50; iteration++) {
      let overlapsFound = false;
      
      for (let i = 0; i < nodePositions.length; i++) {
        for (let j = i + 1; j < nodePositions.length; j++) {
          const node1 = nodePositions[i];
          const node2 = nodePositions[j];
          
          const dx = node2.x - node1.x;
          const dy = node2.y - node1.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < minNodeDistance && distance > 0) {
            overlapsFound = true;
            
            // Calculate separation vector
            const separation = minNodeDistance - distance;
            const separationX = (dx / distance) * separation * 0.5;
            const separationY = (dy / distance) * separation * 0.5;
            
            // Move nodes apart
            node1.x -= separationX;
            node1.y -= separationY;
            node2.x += separationX;
            node2.y += separationY;
            
            // Keep nodes within bounds
            node1.x = Math.max(padding, Math.min(innerWidth - padding, node1.x));
            node1.y = Math.max(padding, Math.min(innerHeight - padding, node1.y));
            node2.x = Math.max(padding, Math.min(innerWidth - padding, node2.x));
            node2.y = Math.max(padding, Math.min(innerHeight - padding, node2.y));
          }
        }
      }
      
      if (!overlapsFound) break;
    }
    
    return nodePositions;
  }
  
  // Resolve node overlaps
  const adjustedNodes = resolveNodeOverlaps(nodes);
  
  // Create node lookup for positioning (using adjusted positions)
  const nodeMap = {};
  adjustedNodes.forEach(d => {
    nodeMap[d.id] = {
      x: d.x,
      y: d.y,
      data: d.data
    };
  });
  
  // Add subtle grid lines for better readability
  g.append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(yScale)
      .tickSize(-innerWidth)
      .tickFormat("")
    )
    .style("stroke-dasharray", "2,2")
    .style("opacity", 0.1)
    .style("stroke", "#6c757d");
  
  g.append("g")
    .attr("class", "grid")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScale)
      .tickSize(-innerHeight)
      .tickFormat("")
    )
    .style("stroke-dasharray", "2,2")
    .style("opacity", 0.1)
    .style("stroke", "#6c757d");
  
  // Define arrow marker with improved style
  defs.append("marker")
    .attr("id", "arrow")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 10)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", "#ffc107")
    .attr("stroke", "#fd7e14")
    .attr("stroke-width", 0.5);
  
  // Draw edges with improved styling
  g.selectAll("line.edge")
    .data(edges)
    .enter()
    .append("line")
    .attr("class", "edge")
    .attr("x1", d => nodeMap[d["Inlet Node"]]?.x || 0)
    .attr("y1", d => nodeMap[d["Inlet Node"]]?.y || 0)
    .attr("x2", d => nodeMap[d["Outlet Node"]]?.x || 0)
    .attr("y2", d => nodeMap[d["Outlet Node"]]?.y || 0)
    .attr("stroke", "#ffc107")
    .attr("stroke-width", 2.5)
    .attr("marker-end", "url(#arrow)")
    .style("cursor", "pointer")
    .style("opacity", 0.8)
    .on("mouseover", function(event, d) {
      d3.select(this)
        .attr("stroke", "#fd7e14")
        .attr("stroke-width", 4)
        .style("opacity", 1);
      let content = `<strong>Pipe Information</strong><br>`;
      for (let key in d) {
        if (d[key] && d[key] !== "0") content += `${key}: ${d[key]}<br>`;
      }
      tooltip.html(content)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 20) + "px")
        .style("opacity", 1);
    })
    .on("mousemove", event => {
      tooltip.style("left", (event.pageX + 10) + "px")
             .style("top", (event.pageY - 20) + "px");
    })
    .on("mouseout", function() {
      d3.select(this)
        .attr("stroke", "#ffc107")
        .attr("stroke-width", 2.5)
        .style("opacity", 0.8);
      tooltip.style("opacity", 0);
    });
  
  // Draw nodes with improved styling using adjusted positions
  g.selectAll("circle")
    .data(adjustedNodes)
    .enter()
    .append("circle")
    .attr("cx", d => d.x)
    .attr("cy", d => d.y)
    .attr("r", 7)
    .attr("fill", "#3498db")
    .attr("stroke", "#2c3e50")
    .attr("stroke-width", 2)
    .style("cursor", "pointer")
    .style("filter", "drop-shadow(2px 2px 4px rgba(0,0,0,0.2))")
    .on("mouseover", function(event, d) {
      d3.select(this)
        .attr("fill", "#e74c3c")
        .attr("r", 9)
        .style("filter", "drop-shadow(2px 2px 6px rgba(0,0,0,0.4))");
      let content = `<strong>Manhole - ${d.data["Node ID"]}</strong><br>`;
      for (let key in d.data) {
        if (d.data[key] && d.data[key] !== "0") content += `${key}: ${d.data[key]}<br>`;
      }
      tooltip.html(content)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 20) + "px")
        .style("opacity", 1);
    })
    .on("mousemove", event => {
      tooltip.style("left", (event.pageX + 10) + "px")
             .style("top", (event.pageY - 20) + "px");
    })
    .on("mouseout", function() {
      d3.select(this)
        .attr("fill", "#3498db")
        .attr("r", 7)
        .style("filter", "drop-shadow(2px 2px 4px rgba(0,0,0,0.2))");
      tooltip.style("opacity", 0);
    });
  
  // Node labels with better positioning using adjusted positions
  g.selectAll("text.label")
    .data(adjustedNodes)
    .enter()
    .append("text")
    .attr("class", "label")
    .attr("x", d => d.x + 10)
    .attr("y", d => d.y - 10)
    .text(d => d.data["Node ID"])
    .style("font-size", "10px")
    .style("font-weight", "600")
    .style("fill", "#2c3e50")
    .style("pointer-events", "none")
    .style("text-shadow", "1px 1px 2px rgba(255,255,255,0.8)");
  
  // Add legend with improved styling (positioned independently, no rotation/zoom)
  const legend = legendGroup.append("g")
    .attr("transform", `translate(${width - 160}, ${height - 110})`);
  
  // Legend background with map-like styling
  legend.append("rect")
    .attr("x", -15)
    .attr("y", -15)
    .attr("width", 150)
    .attr("height", 75)
    .attr("fill", "rgba(248, 249, 250, 0.95)")
    .attr("stroke", "#adb5bd")
    .attr("stroke-width", 1)
    .attr("rx", 5)
    .style("filter", "drop-shadow(2px 2px 4px rgba(0,0,0,0.1))");
  
  // Node legend
  legend.append("circle")
    .attr("cx", 10)
    .attr("cy", 10)
    .attr("r", 7)
    .attr("fill", "#3498db")
    .attr("stroke", "#2c3e50")
    .attr("stroke-width", 2);
  
  legend.append("text")
    .attr("x", 25)
    .attr("y", 15)
    .text("Manholes")
    .style("font-size", "12px")
    .style("fill", "#2c3e50")
    .style("font-weight", "500");
  
  // Edge legend
  legend.append("line")
    .attr("x1", 0)
    .attr("y1", 35)
    .attr("x2", 20)
    .attr("y2", 35)
    .attr("stroke", "#ffc107")
    .attr("stroke-width", 2.5)
    .attr("marker-end", "url(#arrow)");
  
  legend.append("text")
    .attr("x", 25)
    .attr("y", 40)
    .text("Pipes (flow)")
    .style("font-size", "12px")
    .style("fill", "#2c3e50")
    .style("font-weight", "500");
  
  // Add overlap resolution indicator
  legend.append("text")
    .attr("x", 0)
    .attr("y", 60)
    // .text("✓ Overlap resolved")
    .style("font-size", "10px")
    .style("fill", "#28a745")
    .style("font-weight", "500");
  
  // Add rotation indicator
  legend.append("text")
    .attr("x", 0)
    .attr("y", 80)
    // .text(`↻ Rotated ${ROTATION_ANGLE}°`)
    .style("font-size", "10px")
    .style("fill", "#6f42c1")
    .style("font-weight", "500");
  
  // Add zoom indicator
  legend.append("text")
    .attr("x", 0)
    .attr("y", 100)
    // .text(`🔍 Zoom ${(ZOOM_FACTOR * 100).toFixed(0)}%`)
    .style("font-size", "10px")
    .style("fill", "#17a2b8")
    .style("font-weight", "500");
  
  // Add axes labels with improved styling
  g.append("text")
    .attr("transform", `translate(${innerWidth/2}, ${innerHeight + 45})`)
    .style("text-anchor", "middle")
    .style("font-size", "13px")
    .style("fill", "#495057")
    .style("font-weight", "500")
    .text("X Coordinate (meters)");
  
  g.append("text")
    .attr("transform", `rotate(-90) translate(${-innerHeight/2}, -45)`)
    .style("text-anchor", "middle")
    .style("font-size", "13px")
    .style("fill", "#495057")
    .style("font-weight", "500")
    .text("Y Coordinate (meters)");
});