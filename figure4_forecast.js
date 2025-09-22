// figure4_forecast.js - Time series forecasting visualization with CSV data
const forecastTooltip = d3.select("#tooltip");

// Global variables
let forecastData = {};
let depthData = [];
let rateData = [];
let allNodes = [];
let selectedNode = '';
let forecastSteps = 1;
let currentMetric = 'depth'; // 'depth' or 'rate'

// Load CSV data
async function loadCSVData() {
    try {
        // Load both CSV files
        const depthCsv = await d3.csv("Flow_depth.csv");
        const rateCsv = await d3.csv("Flow_rate.csv");
        
        depthData = depthCsv;
        rateData = rateCsv;
        
        // Extract node names from columns (excluding period, period_start, period_end)
        const excludeColumns = ['period', 'period_start', 'period_end'];
        allNodes = Object.keys(depthData[0]).filter(col => !excludeColumns.includes(col));
        
        // Set default selected node
        selectedNode = allNodes[0];
        
        // Process the data for forecasting
        processDataForForecasting();
        
        console.log("CSV data loaded successfully");
        console.log("Available nodes:", allNodes);
        console.log("Sample depth data:", depthData.slice(0, 2));
        console.log("Sample rate data:", rateData.slice(0, 2));
        
    } catch (error) {
        console.error("Error loading CSV data:", error);
        // Fallback to dummy data if CSV loading fails
        generateSampleData();
    }
}

// Process data for forecasting structure
function processDataForForecasting() {
    forecastData = {};
    
    allNodes.forEach(nodeId => {
        forecastData[nodeId] = {
            nodeId: nodeId,
            historical: {
                depth: [],
                rate: []
            }
        };
        
        // Process depth data
        depthData.forEach((row, index) => {
            if (row[nodeId] && !isNaN(parseFloat(row[nodeId]))) {
                forecastData[nodeId].historical.depth.push({
                    time: index,
                    period: row.period,
                    period_start: row.period_start,
                    period_end: row.period_end,
                    value: parseFloat(row[nodeId])
                });
            }
        });
        
        // Process rate data
        rateData.forEach((row, index) => {
            if (row[nodeId] && !isNaN(parseFloat(row[nodeId]))) {
                forecastData[nodeId].historical.rate.push({
                    time: index,
                    period: row.period,
                    period_start: row.period_start,
                    period_end: row.period_end,
                    value: parseFloat(row[nodeId])
                });
            }
        });
    });
}

// Simple forecasting using moving average and trend
function generateForecast(historicalData, steps) {
    if (historicalData.length < 2) return [];
    
    const forecast = [];
    const windowSize = Math.min(3, historicalData.length); // Use last 3 points for trend
    
    // Calculate moving average and trend
    let sum = 0;
    let trendSum = 0;
    
    for (let i = historicalData.length - windowSize; i < historicalData.length; i++) {
        sum += historicalData[i].value;
        if (i > historicalData.length - windowSize) {
            trendSum += historicalData[i].value - historicalData[i-1].value;
        }
    }
    
    const avg = sum / windowSize;
    const trend = windowSize > 1 ? trendSum / (windowSize - 1) : 0;
    
    // Generate forecast points
    const lastTime = historicalData[historicalData.length - 1].time;
    const lastPeriod = historicalData[historicalData.length - 1].period;
    
    for (let i = 1; i <= steps; i++) {
        // Simple linear forecast with some noise reduction
        const forecastValue = avg + (trend * i * 0.7); // Reduce trend impact for stability
        
        forecast.push({
            time: lastTime + i,
            period: `${lastPeriod}-forecast-${i}`,
            period_start: 'Forecasted',
            period_end: 'Forecasted',
            value: Math.max(0, forecastValue) // Ensure non-negative values
        });
    }
    
    return forecast;
}

// Fallback sample data generation (in case CSV loading fails)
function generateSampleData() {
    allNodes = ['92090040', '92090041', '92090042', '92090070', '92090090'];
    selectedNode = allNodes[0];
    forecastData = {};
    
    allNodes.forEach(nodeId => {
        forecastData[nodeId] = {
            nodeId: nodeId,
            historical: {
                depth: [],
                rate: []
            }
        };
        
        // Generate sample historical data
        let baseDepth = 2 + Math.random() * 3;
        let baseRate = 10 + Math.random() * 20;
        
        for (let t = 0; t < 12; t++) {
            forecastData[nodeId].historical.depth.push({
                time: t,
                period: `2023-${10 + Math.floor(t/6)}-${(t % 6) + 1}`,
                period_start: `2023-${10 + Math.floor(t/6)}-${(t % 6) + 1} 00:00:00`,
                period_end: `2023-${10 + Math.floor(t/6)}-${(t % 6) + 1} 23:59:59`,
                value: baseDepth + Math.sin(t * 0.5) * 0.5 + (Math.random() - 0.5) * 0.3
            });
            
            forecastData[nodeId].historical.rate.push({
                time: t,
                period: `2023-${10 + Math.floor(t/6)}-${(t % 6) + 1}`,
                period_start: `2023-${10 + Math.floor(t/6)}-${(t % 6) + 1} 00:00:00`,
                period_end: `2023-${10 + Math.floor(t/6)}-${(t % 6) + 1} 23:59:59`,
                value: baseRate + Math.sin(t * 0.3) * 5 + (Math.random() - 0.5) * 2
            });
        }
    });
}

// Initialize the forecast chart
async function initForecastChart() {
    // Load CSV data first
    await loadCSVData();
    
    const container = d3.select("#forecast-container");
    
    // Add controls if not exists
    if (container.select(".forecast-controls").empty()) {
        const controls = container.insert("div", ":first-child")
            .attr("class", "forecast-controls")
            .style("margin-bottom", "20px")
            .style("text-align", "center");
        
        // Node selector
        const nodeSelector = controls.append("span").style("margin-right", "20px");
        nodeSelector.append("label").text("Select Node: ").style("margin-right", "5px");
        const nodeSelect = nodeSelector.append("select")
            .attr("id", "node-selector")
            .style("padding", "5px")
            .style("margin-right", "20px");
        
        nodeSelect.selectAll("option")
            .data(allNodes)
            .enter()
            .append("option")
            .attr("value", d => d)
            .text(d => d);
        
        nodeSelect.property("value", selectedNode);
        
        nodeSelect.on("change", function() {
            selectedNode = this.value;
            updateForecastVisualization();
        });
        
        // Metric selector
        const metricSelector = controls.append("span").style("margin-right", "20px");
        metricSelector.append("label").text("Metric: ").style("margin-right", "5px");
        
        const metrics = [
            {value: 'depth', label: 'Depth (ft)'},
            {value: 'rate', label: 'Rate (cfs)'}
        ];
        
        metricSelector.selectAll("button")
            .data(metrics)
            .enter()
            .append("button")
            .style("margin", "0 5px")
            .style("padding", "5px 10px")
            .style("background", d => d.value === currentMetric ? "#4682b4" : "#ddd")
            .style("color", d => d.value === currentMetric ? "white" : "black")
            .style("border", "none")
            .style("cursor", "pointer")
            .text(d => d.label)
            .on("click", function(event, d) {
                currentMetric = d.value;
                metricSelector.selectAll("button")
                    .style("background", btn => btn.value === currentMetric ? "#4682b4" : "#ddd")
                    .style("color", btn => btn.value === currentMetric ? "white" : "black");
                updateForecastVisualization();
            });
        
        // Forecast steps buttons
        const stepsSelector = controls.append("span");
        stepsSelector.append("label").text("Forecast: ").style("margin-right", "5px");
        
        const steps = [1, 6, 12];
        stepsSelector.selectAll("button.step-btn")
            .data(steps)
            .enter()
            .append("button")
            .attr("class", "step-btn")
            .style("margin", "0 5px")
            .style("padding", "5px 10px")
            .style("background", d => d === forecastSteps ? "#4682b4" : "#ddd")
            .style("color", d => d === forecastSteps ? "white" : "black")
            .style("border", "none")
            .style("cursor", "pointer")
            .text(d => d + (d === 1 ? " Step" : " Steps"))
            .on("click", function(event, d) {
                updateForecast(d);
            });
    }
    
    // Create SVG
    const svg = d3.select("#forecast-chart");
    svg.selectAll("*").remove(); // Clear existing content
    
    const width = +svg.attr("width");
    const height = +svg.attr("height");
    const margin = {top: 40, right: 80, bottom: 80, left: 80};
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // Add chart title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", 25)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .text("Time Series Forecasting for Water System Monitoring");
    
    updateForecastVisualization();
}

// Update forecast steps
function updateForecast(steps) {
    forecastSteps = steps;
    
    // Update button styles
    d3.selectAll(".step-btn")
        .style("background", d => d === forecastSteps ? "#4682b4" : "#ddd")
        .style("color", d => d === forecastSteps ? "white" : "black");
    
    updateForecastVisualization();
}

// Update the visualization
function updateForecastVisualization() {
    if (!forecastData[selectedNode]) {
        console.error("No data for selected node:", selectedNode);
        return;
    }
    
    const svg = d3.select("#forecast-chart");
    const width = +svg.attr("width");
    const height = +svg.attr("height");
    const margin = {top: 40, right: 80, bottom: 80, left: 80};
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // Clear previous chart content (except title)
    svg.selectAll("g").remove();
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // Get data for selected node and metric
    const historicalData = forecastData[selectedNode].historical[currentMetric];
    const forecastToShow = generateForecast(historicalData, forecastSteps);
    
    if (historicalData.length === 0) {
        // Show "No data available" message
        g.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-size", "18px")
            .style("fill", "#999")
            .text(`No ${currentMetric} data available for node ${selectedNode}`);
        return;
    }
    
    // Combine data for scales
    const allData = [...historicalData, ...forecastToShow];
    
    // Create scales
    const xScale = d3.scaleLinear()
        .domain([0, Math.max(historicalData.length - 1 + forecastSteps, historicalData.length)])
        .range([0, innerWidth]);
    
    const yExtent = d3.extent(allData, d => d.value);
    const yPadding = (yExtent[1] - yExtent[0]) * 0.1;
    
    const yScale = d3.scaleLinear()
        .domain([yExtent[0] - yPadding, yExtent[1] + yPadding])
        .range([innerHeight, 0]);
    
    // Create line generators
    const historicalLine = d3.line()
        .x(d => xScale(d.time))
        .y(d => yScale(d.value))
        .curve(d3.curveMonotoneX);
    
    const forecastLine = d3.line()
        .x(d => xScale(d.time))
        .y(d => yScale(d.value))
        .curve(d3.curveMonotoneX);
    
    // Add grid lines
    g.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale)
            .tickSize(-innerHeight)
            .tickFormat("")
        )
        .style("stroke-dasharray", "3,3")
        .style("opacity", 0.3);
    
    g.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(yScale)
            .tickSize(-innerWidth)
            .tickFormat("")
        )
        .style("stroke-dasharray", "3,3")
        .style("opacity", 0.3);
    
    // Add axes
    const xAxis = d3.axisBottom(xScale)
        .tickFormat(d => {
            const index = Math.floor(d);
            if (index < historicalData.length) {
                return historicalData[index] ? historicalData[index].period : `t${index}`;
            } else {
                return `pred${index - historicalData.length + 1}`;
            }
        });
    
    const yAxis = d3.axisLeft(yScale)
        .tickFormat(d => d.toFixed(2));
    
    g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(xAxis)
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-45)");
    
    g.append("text")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + 60)
        .attr("fill", "black")
        .style("text-anchor", "middle")
        .text("Time Period");
    
    g.append("g")
        .call(yAxis)
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -50)
        .attr("x", -innerHeight / 2)
        .attr("fill", "black")
        .style("text-anchor", "middle")
        .text(currentMetric === 'depth' ? "Water Depth (ft)" : "Flow Rate (cfs)");
    
    // Add vertical line separating historical and forecast
    if (forecastToShow.length > 0) {
        const separatorX = xScale(historicalData.length - 0.5);
        g.append("line")
            .attr("x1", separatorX)
            .attr("y1", 0)
            .attr("x2", separatorX)
            .attr("y2", innerHeight)
            .attr("stroke", "#999")
            .attr("stroke-dasharray", "5,5")
            .attr("opacity", 0.7);
        
        // Add label for the separator
        g.append("text")
            .attr("x", separatorX)
            .attr("y", -5)
            .attr("text-anchor", "middle")
            .attr("fill", "#999")
            .style("font-size", "12px")
            .text("Forecast Start");
    }
    
    // Draw historical line
    g.append("path")
        .datum(historicalData)
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 2.5)
        .attr("d", historicalLine);
    
    // Draw forecast line
    if (forecastToShow.length > 0) {
        // Connect historical to forecast with a dashed line
        const connectionData = [
            historicalData[historicalData.length - 1],
            forecastToShow[0]
        ];
        
        g.append("path")
            .datum(connectionData)
            .attr("fill", "none")
            .attr("stroke", "orange")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "5,5")
            .attr("d", historicalLine);
        
        // Draw forecast line
        g.append("path")
            .datum(forecastToShow)
            .attr("fill", "none")
            .attr("stroke", "orange")
            .attr("stroke-width", 2.5)
            .attr("d", forecastLine);
    }
    
    // Add dots for historical data points
    g.selectAll(".historical-dot")
        .data(historicalData)
        .enter()
        .append("circle")
        .attr("class", "historical-dot")
        .attr("cx", d => xScale(d.time))
        .attr("cy", d => yScale(d.value))
        .attr("r", 4)
        .attr("fill", "steelblue")
        .attr("stroke", "white")
        .attr("stroke-width", 1.5)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("r", 6);
            forecastTooltip
                .html(`<strong>Historical - ${selectedNode}</strong><br>
                       Period: ${d.period}<br>
                       Value: ${d.value.toFixed(3)} ${currentMetric === 'depth' ? 'ft' : 'cfs'}<br>
                       Start: ${d.period_start}<br>
                       End: ${d.period_end}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 20) + "px")
                .style("opacity", 1);
        })
        .on("mouseout", function() {
            d3.select(this).attr("r", 4);
            forecastTooltip.style("opacity", 0);
        });
    
    // Add dots for forecast data points
    if (forecastToShow.length > 0) {
        g.selectAll(".forecast-dot")
            .data(forecastToShow)
            .enter()
            .append("circle")
            .attr("class", "forecast-dot")
            .attr("cx", d => xScale(d.time))
            .attr("cy", d => yScale(d.value))
            .attr("r", 4)
            .attr("fill", "orange")
            .attr("stroke", "white")
            .attr("stroke-width", 1.5)
            .on("mouseover", function(event, d) {
                d3.select(this).attr("r", 6);
                forecastTooltip
                    .html(`<strong>Forecast - ${selectedNode}</strong><br>
                           Period: ${d.period}<br>
                           Value: ${d.value.toFixed(3)} ${currentMetric === 'depth' ? 'ft' : 'cfs'}<br>
                           Type: Predicted`)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 20) + "px")
                    .style("opacity", 1);
            })
            .on("mouseout", function() {
                d3.select(this).attr("r", 4);
                forecastTooltip.style("opacity", 0);
            });
    }
    
    // Add legend
    const legend = g.append("g")
        .attr("transform", `translate(${innerWidth - 120}, 20)`);
    
    // Historical legend
    legend.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", 20)
        .attr("y2", 0)
        .attr("stroke", "steelblue")
        .attr("stroke-width", 2.5);
    
    legend.append("circle")
        .attr("cx", 10)
        .attr("cy", 0)
        .attr("r", 4)
        .attr("fill", "steelblue")
        .attr("stroke", "white")
        .attr("stroke-width", 1.5);
    
    legend.append("text")
        .attr("x", 25)
        .attr("y", 5)
        .style("font-size", "12px")
        .text("Historical");
    
    // Forecast legend
    legend.append("line")
        .attr("x1", 0)
        .attr("y1", 20)
        .attr("x2", 20)
        .attr("y2", 20)
        .attr("stroke", "orange")
        .attr("stroke-width", 2.5);
    
    legend.append("circle")
        .attr("cx", 10)
        .attr("cy", 20)
        .attr("r", 4)
        .attr("fill", "orange")
        .attr("stroke", "white")
        .attr("stroke-width", 1.5);
    
    legend.append("text")
        .attr("x", 25)
        .attr("y", 25)
        .style("font-size", "12px")
        .text("Forecast");
    
    // Add current value display
    const currentValue = g.append("g")
        .attr("transform", `translate(20, 20)`);
    
    currentValue.append("rect")
        .attr("x", -5)
        .attr("y", -15)
        .attr("width", 200)
        .attr("height", 30)
        .attr("fill", "white")
        .attr("stroke", "#ddd")
        .attr("rx", 3);
    
    const lastHistorical = historicalData[historicalData.length - 1];
    currentValue.append("text")
        .attr("x", 5)
        .attr("y", 5)
        .style("font-size", "14px")
        .text(`Current: ${lastHistorical.value.toFixed(3)} ${currentMetric === 'depth' ? 'ft' : 'cfs'}`);
}

// Initialize when page loads
document.addEventListener("DOMContentLoaded", function() {
    // Wait a bit to ensure the container exists
    setTimeout(initForecastChart, 100);
});