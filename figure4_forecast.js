// figure4_forecast.js - Time series forecasting visualization with CSV data
const forecastTooltip = d3.select("#tooltip");

// Global variables
let forecastData = [];
let selectedNode = null;
let forecastSteps = 1;
let currentMetric = 'depth'; // 'depth' or 'rate'
let depthData = [];
let rateData = [];

// Simple moving average forecasting function
function simpleMovingAveragePredict(data, steps, windowSize = 3) {
    const forecasts = [];
    let currentData = [...data];
    
    for (let step = 0; step < steps; step++) {
        // Take the last windowSize points for moving average
        const lastPoints = currentData.slice(-windowSize);
        const average = lastPoints.reduce((sum, val) => sum + val, 0) / lastPoints.length;
        
        // Add some trend if data length > windowSize
        let trend = 0;
        if (currentData.length >= windowSize + 1) {
            const recentAvg = lastPoints.reduce((sum, val) => sum + val, 0) / lastPoints.length;
            const previousPoints = currentData.slice(-(windowSize + 1), -1);
            const previousAvg = previousPoints.reduce((sum, val) => sum + val, 0) / previousPoints.length;
            trend = (recentAvg - previousAvg) * 0.3; // Damped trend
        }
        
        const prediction = average + trend + (Math.random() - 0.5) * average * 0.05; // Add small noise
        forecasts.push(Math.max(0, prediction)); // Ensure non-negative values
        currentData.push(prediction); // Add prediction to data for next iteration
    }
    
    return forecasts;
}

// Linear regression forecasting function
function linearRegressionPredict(data, steps) {
    const n = data.length;
    const x = Array.from({length: n}, (_, i) => i);
    const y = data;
    
    // Calculate linear regression parameters
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Generate predictions
    const forecasts = [];
    for (let step = 1; step <= steps; step++) {
        const prediction = intercept + slope * (n + step - 1);
        forecasts.push(Math.max(0, prediction)); // Ensure non-negative values
    }
    
    return forecasts;
}

// Parse CSV data
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',');
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const row = {};
        headers.forEach((header, index) => {
            row[header.trim()] = values[index] ? values[index].trim() : '';
        });
        data.push(row);
    }
    
    return data;
}

// Load CSV data
async function loadCSVData() {
    try {
        // Try to read the CSV files
        let depthCSV, rateCSV;
        
        try {
            const depthBuffer = await window.fs.readFile('Flow_depth.csv', { encoding: 'utf8' });
            depthCSV = depthBuffer;
        } catch (error) {
            console.warn('Could not read Flow_depth.csv, using sample data');
            depthCSV = generateSampleDepthCSV();
        }
        
        try {
            const rateBuffer = await window.fs.readFile('Flow_rate.csv', { encoding: 'utf8' });
            rateCSV = rateBuffer;
        } catch (error) {
            console.warn('Could not read Flow_rate.csv, using sample data');
            rateCSV = generateSampleRateCSV();
        }
        
        depthData = parseCSV(depthCSV);
        rateData = parseCSV(rateCSV);
        
        // Process the data
        processCSVData();
        
    } catch (error) {
        console.error('Error loading CSV data:', error);
        // Fallback to sample data
        generateSampleCSVData();
    }
}

// Generate sample CSV data if files are not available
function generateSampleDepthCSV() {
    let csv = 'period,92090040,92090041,92090042,92090070,92090090,92090100,92100100,92100110,92100120,92100130,92100150,92100160,92100170,92100190,92100220,92100230,92100240,92100250,92100260,92100280,92100300,92100320,OF-1,period_start,period_end\n';
    
    for (let i = 1; i <= 12; i++) {
        let row = `t${i}`;
        // Generate random data for each node
        for (let j = 0; j < 23; j++) {
            const baseValue = 500 + Math.random() * 500;
            const seasonality = Math.sin(i * 0.5) * 100;
            const noise = (Math.random() - 0.5) * 50;
            row += `,${(baseValue + seasonality + noise).toFixed(2)}`;
        }
        row += `,2023-${String(i).padStart(2, '0')}-01 00:00:00,2023-${String(i).padStart(2, '0')}-15 23:50:00\n`;
        csv += row;
    }
    return csv;
}

function generateSampleRateCSV() {
    let csv = 'period,92090040,92090041,92090042,92090070,92090090,92090100,92100100,92100110,92100120,92100130,92100150,92100160,92100170,92100190,92100220,92100230,92100240,92100250,92100260,92100280,92100300,92100320,OF-1,period_start,period_end\n';
    
    for (let i = 1; i <= 12; i++) {
        let row = `t${i}`;
        // Generate random data for each node
        for (let j = 0; j < 23; j++) {
            const baseValue = 200 + Math.random() * 300;
            const seasonality = Math.sin(i * 0.3) * 50;
            const noise = (Math.random() - 0.5) * 30;
            row += `,${(baseValue + seasonality + noise).toFixed(2)}`;
        }
        row += `,2023-${String(i).padStart(2, '0')}-01 00:00:00,2023-${String(i).padStart(2, '0')}-15 23:50:00\n`;
        csv += row;
    }
    return csv;
}

function generateSampleCSVData() {
    depthData = parseCSV(generateSampleDepthCSV());
    rateData = parseCSV(generateSampleRateCSV());
    processCSVData();
}

// Process CSV data into the format needed for visualization
function processCSVData() {
    // Get all node columns (exclude period, period_start, period_end)
    const nodeColumns = Object.keys(depthData[0]).filter(col => 
        !['period', 'period_start', 'period_end'].includes(col)
    );
    
    forecastData = [];
    
    nodeColumns.forEach(nodeId => {
        const nodeData = {
            nodeId: nodeId,
            historical: [],
            forecast: []
        };
        
        // Extract historical data for depth
        depthData.forEach((row, index) => {
            const value = parseFloat(row[nodeId]);
            if (!isNaN(value)) {
                nodeData.historical.push({
                    time: index,
                    depth: value,
                    rate: rateData[index] ? parseFloat(rateData[index][nodeId]) || 0 : 0
                });
            }
        });
        
        // Generate forecasts using linear regression for better predictions
        if (nodeData.historical.length > 0) {
            const depthValues = nodeData.historical.map(d => d.depth);
            const rateValues = nodeData.historical.map(d => d.rate);
            
            // Generate forecasts for up to 12 steps
            const depthForecasts = linearRegressionPredict(depthValues, 12);
            const rateForecasts = linearRegressionPredict(rateValues, 12);
            
            for (let step = 0; step < 12; step++) {
                nodeData.forecast.push({
                    time: nodeData.historical.length + step,
                    depth: depthForecasts[step],
                    rate: rateForecasts[step]
                });
            }
        }
        
        forecastData.push(nodeData);
    });
    
    // Set default selected node
    if (forecastData.length > 0) {
        selectedNode = forecastData[0].nodeId;
    }
    
    console.log('Processed forecast data:', forecastData);
}

// Initialize the forecast chart
function initForecastChart() {
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
        
        nodeSelect.on("change", function() {
            selectedNode = this.value;
            updateForecastVisualization();
        });
        
        // Metric selector
        const metricSelector = controls.append("span").style("margin-right", "20px");
        metricSelector.append("label").text("Metric: ").style("margin-right", "5px");
        
        const metrics = [
            {value: 'depth', label: 'Depth'},
            {value: 'rate', label: 'Rate'}
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
    if (svg.empty()) {
        console.error("SVG element #forecast-chart not found");
        return;
    }
    
    svg.selectAll("*").remove(); // Clear existing content
    
    const width = +svg.attr("width") || 800;
    const height = +svg.attr("height") || 400;
    const margin = {top: 40, right: 80, bottom: 60, left: 60};
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
    
    // Update node selector options
    updateNodeSelector();
    updateForecastVisualization();
}

// Update node selector with available nodes
function updateNodeSelector() {
    const nodeSelect = d3.select("#node-selector");
    if (nodeSelect.empty()) return;
    
    nodeSelect.selectAll("option").remove();
    
    nodeSelect.selectAll("option")
        .data(forecastData)
        .enter()
        .append("option")
        .attr("value", d => d.nodeId)
        .text(d => d.nodeId);
    
    // Set selected node
    if (selectedNode && forecastData.find(d => d.nodeId === selectedNode)) {
        nodeSelect.property("value", selectedNode);
    } else if (forecastData.length > 0) {
        selectedNode = forecastData[0].nodeId;
        nodeSelect.property("value", selectedNode);
    }
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
    const svg = d3.select("#forecast-chart");
    if (svg.empty() || !selectedNode || forecastData.length === 0) return;
    
    const width = +svg.attr("width") || 800;
    const height = +svg.attr("height") || 400;
    const margin = {top: 40, right: 80, bottom: 60, left: 60};
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // Clear previous chart content (except title)
    svg.selectAll("g").remove();
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // Get data for selected node
    const nodeData = forecastData.find(d => d.nodeId === selectedNode);
    if (!nodeData) return;
    
    const historicalData = nodeData.historical;
    const forecastToShow = nodeData.forecast.slice(0, forecastSteps);
    
    // Combine data for scales
    const allData = [...historicalData, ...forecastToShow];
    
    // Create scales
    const xScale = d3.scaleLinear()
        .domain([0, historicalData.length - 1 + forecastSteps])
        .range([0, innerWidth]);
    
    const yExtent = d3.extent(allData, d => d[currentMetric]);
    
    const yScale = d3.scaleLinear()
        .domain([Math.min(0, yExtent[0] * 0.9), yExtent[1] * 1.1])
        .range([innerHeight, 0]);
    
    // Create line generators
    const historicalLine = d3.line()
        .x(d => xScale(d.time))
        .y(d => yScale(d[currentMetric]))
        .curve(d3.curveMonotoneX);
    
    const forecastLine = d3.line()
        .x(d => xScale(d.time))
        .y(d => yScale(d[currentMetric]))
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
        .tickFormat(d => d < historicalData.length ? `t${Math.floor(d)+1}` : `t${Math.floor(d)+1} (pred)`);
    
    const yAxis = d3.axisLeft(yScale)
        .tickFormat(d => d.toFixed(1));
    
    g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(xAxis)
        .append("text")
        .attr("x", innerWidth / 2)
        .attr("y", 40)
        .attr("fill", "black")
        .style("text-anchor", "middle")
        .text("Time Steps");
    
    g.append("g")
        .call(yAxis)
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -40)
        .attr("x", -innerHeight / 2)
        .attr("fill", "black")
        .style("text-anchor", "middle")
        .text(currentMetric === 'depth' ? "Depth Value" : "Rate Value");
    
    // Add vertical line separating historical and forecast
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
    
    // Draw historical line
    if (historicalData.length > 0) {
        g.append("path")
            .datum(historicalData)
            .attr("fill", "none")
            .attr("stroke", "steelblue")
            .attr("stroke-width", 2.5)
            .attr("d", historicalLine);
    }
    
    // Draw forecast line
    if (forecastToShow.length > 0) {
        // Connect historical to forecast with a dashed line
        const connectionData = [
            historicalData[historicalData.length - 1],
            {...forecastToShow[0], time: historicalData.length}
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
    
    // Add dots for data points
    g.selectAll(".historical-dot")
        .data(historicalData)
        .enter()
        .append("circle")
        .attr("class", "historical-dot")
        .attr("cx", d => xScale(d.time))
        .attr("cy", d => yScale(d[currentMetric]))
        .attr("r", 4)
        .attr("fill", "steelblue")
        .attr("stroke", "white")
        .attr("stroke-width", 1.5)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("r", 6);
            forecastTooltip
                .html(`<strong>Historical - ${selectedNode}</strong><br>
                       Time: t${d.time + 1}<br>
                       ${currentMetric === 'depth' ? 'Depth' : 'Rate'}: ${d[currentMetric].toFixed(2)}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 20) + "px")
                .style("opacity", 1);
        })
        .on("mouseout", function() {
            d3.select(this).attr("r", 4);
            forecastTooltip.style("opacity", 0);
        });
    
    if (forecastToShow.length > 0) {
        g.selectAll(".forecast-dot")
            .data(forecastToShow)
            .enter()
            .append("circle")
            .attr("class", "forecast-dot")
            .attr("cx", d => xScale(d.time))
            .attr("cy", d => yScale(d[currentMetric]))
            .attr("r", 4)
            .attr("fill", "orange")
            .attr("stroke", "white")
            .attr("stroke-width", 1.5)
            .on("mouseover", function(event, d) {
                d3.select(this).attr("r", 6);
                forecastTooltip
                    .html(`<strong>Forecast - ${selectedNode}</strong><br>
                           Time: t${d.time + 1}<br>
                           ${currentMetric === 'depth' ? 'Depth' : 'Rate'}: ${d[currentMetric].toFixed(2)}`)
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
        .attr("transform", `translate(${innerWidth - 100}, 20)`);
    
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
        .text("Forecast");
    
    // Add current value display
    const currentValue = g.append("g")
        .attr("transform", `translate(20, 20)`);
    
    currentValue.append("rect")
        .attr("x", -5)
        .attr("y", -15)
        .attr("width", 150)
        .attr("height", 30)
        .attr("fill", "white")
        .attr("stroke", "#ddd")
        .attr("rx", 3);
    
    if (historicalData.length > 0) {
        const lastHistorical = historicalData[historicalData.length - 1];
        currentValue.append("text")
            .attr("x", 5)
            .attr("y", 5)
            .style("font-size", "14px")
            .text(`Current: ${lastHistorical[currentMetric].toFixed(2)}`);
    }
}

// Initialize when page loads
document.addEventListener("DOMContentLoaded", async function() {
    // Load CSV data first
    await loadCSVData();
    
    // Wait a bit to ensure the container exists
    setTimeout(initForecastChart, 100);
});