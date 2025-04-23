// Show the UI
figma.showUI(__html__, { width: 600, height: 500 });

// Main function that runs when the plugin starts
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'export') {
    // Handle export functionality
    exportToCSV();
  }
};

// Start audit when plugin loads
startAudit();

async function startAudit() {
  // Ensure fonts are loaded for text nodes
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  
  // Get the current page
  const currentPage = figma.currentPage;
  
  // Get variable token information
  const variableTokens = await getVariableTokenInfo();
  
  // Collect all nodes on the page
  const allNodes = getAllNodesInPage(currentPage);
  
  // Analyze spacing tokens, passing the variable tokens map
  const spacingTokens = analyzeSpacingTokens(allNodes, variableTokens);
  
  // Send results to UI
  figma.ui.postMessage({
    type: 'results',
    tokens: spacingTokens
  });
}

// Helper function to get variable token information
async function getVariableTokenInfo() {
  // Get all local variables
  const localVariableCollections = figma.variables.getLocalVariableCollections();
  
  // Create a map of all variables for reference
  const variableMap = new Map();
  
  localVariableCollections.forEach(collection => {
    const variables = collection.variableIds.map(id => figma.variables.getVariableById(id));
    
    variables.forEach(variable => {
      if (variable) {
        variableMap.set(variable.id, {
          name: variable.name,
          collectionName: collection.name,
          value: variable.valuesByMode[collection.defaultModeId]
        });
      }
    });
  });
  
  return variableMap;
}

// Helper function to get all nodes recursively
function getAllNodesInPage(node) {
  let nodes = [];
  
  if ('children' in node) {
    for (const child of node.children) {
      nodes = nodes.concat(getAllNodesInPage(child));
    }
  }
  
  nodes.push(node);
  return nodes;
}

// Modify the analyzeSpacingTokens function to use the variable info
function analyzeSpacingTokens(nodes, variableTokens) {
  const spacingTokens = {};
  
  nodes.forEach(node => {
    // Check for auto layout spacing
    if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') {
      // Check if node uses auto layout
      if (node.layoutMode !== 'NONE') {
        const itemSpacing = node.itemSpacing;
        
        // Check if itemSpacing is a token (variable)
        if (node.boundVariables && node.boundVariables.itemSpacing) {
          const variableId = node.boundVariables.itemSpacing.id;
          const variableInfo = variableTokens.get(variableId);
          
          let tokenName = variableInfo ? 
            `${variableInfo.collectionName}/${variableInfo.name}` :
            `Variable ID: ${variableId}`;
          
          // Track usage
          if (!spacingTokens[tokenName]) {
            spacingTokens[tokenName] = {
              value: `${itemSpacing}px`,
              count: 1,
              isToken: true
            };
          } else {
            spacingTokens[tokenName].count++;
          }
        } 
        // If not a token but has spacing, track as raw value
        else if (itemSpacing !== undefined && itemSpacing !== 0) {
          const rawValue = `${itemSpacing}px`;
          if (!spacingTokens[rawValue]) {
            spacingTokens[rawValue] = {
              value: rawValue,
              count: 1,
              isRawValue: true
            };
          } else {
            spacingTokens[rawValue].count++;
          }
        }
      }
      
      // Check for padding tokens
      ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'].forEach(padding => {
        if (node[padding] !== undefined && node[padding] !== 0) {
          // Check if padding is a token
          if (node.boundVariables && node.boundVariables[padding]) {
            const variableId = node.boundVariables[padding].id;
            const variableInfo = variableTokens.get(variableId);
            
            let tokenName = variableInfo ? 
              `${variableInfo.collectionName}/${variableInfo.name}` :
              `Variable ID: ${variableId}`;
            
            // Track usage
            if (!spacingTokens[tokenName]) {
              spacingTokens[tokenName] = {
                value: `${node[padding]}px`,
                count: 1,
                isToken: true
              };
            } else {
              spacingTokens[tokenName].count++;
            }
          } 
          // If not a token but has padding, track as raw value
          else {
            const rawValue = `${node[padding]}px`;
            if (!spacingTokens[rawValue]) {
              spacingTokens[rawValue] = {
                value: rawValue,
                count: 1,
                isRawValue: true
              };
            } else {
              spacingTokens[rawValue].count++;
            }
          }
        }
      });
    }
  });
  
  return spacingTokens;
}

// Export results to CSV
function exportToCSV() {
  // Get the table data from the UI
  const tableData = [];
  const table = document.querySelector('table');
  
  // Add headers
  const headers = [];
  table.querySelectorAll('th').forEach(th => {
    headers.push(th.textContent);
  });
  tableData.push(headers);
  
  // Add rows
  table.querySelectorAll('tr:not(:first-child)').forEach(tr => {
    const row = [];
    tr.querySelectorAll('td').forEach(td => {
      row.push(td.textContent);
    });
    tableData.push(row);
  });
  
  // Create CSV content
  let csvContent = tableData.map(row => row.join(',')).join('\n');
  
  // Trigger download
  figma.ui.eval(`
    const blob = new Blob(['${csvContent}'], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'spacing-token-audit.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  `);
}

// When the plugin is closed
figma.on("close", () => {
  // Clean up if needed
});