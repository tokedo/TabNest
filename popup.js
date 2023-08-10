// Save tabs and close window when "Save For Later" button is clicked
document.getElementById('saveForLater').addEventListener('click', async () => {
  const currentWindow = await chrome.windows.getCurrent({ populate: true });
  const urls = currentWindow.tabs.map(tab => tab.url);
  const activeTab = currentWindow.tabs.find(tab => tab.active);
  const truncatedTitle = activeTab.title.substring(0, 30); // Truncate the title if it's too long

  // Generate the default name
  const timestamp = new Date().getTime();
  const defaultName = `${truncatedTitle} (${new Date(timestamp).toLocaleString()}) - ${urls.length} tab(s)`;

  // Prompt the user for a custom name for the group
  const title = prompt('Enter a name for the new Nest:', defaultName);

  // If title is null, the user cancelled the prompt, so we return without doing anything
  if (title === null) {
    return;
  }

  // Send a message to the background script and wait for a response before closing the window
  chrome.runtime.sendMessage({ action: 'saveTabs', urls, title, windowId: currentWindow.id }, async () => {
    // Close the active window after saving the tabs and receiving a response
    chrome.windows.remove(currentWindow.id);

    // Update the display after closing the active window
    renderSavedTabs();
  });
  
});



// Render the saved tabs list
function renderSavedTabs() {
  const savedTabsContainer = document.getElementById('savedTabsContainer');

  chrome.storage.sync.get(null, (items) => {
    savedTabsContainer.innerHTML = ''; // Clear the container before rendering
	
	const reversedItems = Object.keys(items).map(key => ({ key, value: items[key] })).reverse();

    for (const item of reversedItems) {
		
	  const key = item.key;
		
      const linkWrapper = document.createElement('div');
      linkWrapper.className = 'link-wrapper';

      const linkButtonContainer = document.createElement('div');
      linkButtonContainer.className = 'link-button-container';

      const link = document.createElement('a');
      link.href = '#';

      // Just use the name given by the user or the default name
      link.textContent = items[key].name;
      
	  function createTab(url, windowId) {
	    return new Promise((resolve) => {
	      chrome.tabs.create({ url, windowId }, resolve);
	    });
	  }

	  function createGroup(tabId) {
	    return new Promise((resolve) => {
	      chrome.tabs.group({ tabIds: tabId }, resolve);
	    });
	  }

	  
	  function moveGroup(groupId, windowId, index) {
	    return new Promise((resolve, reject) => {
	      chrome.tabGroups.move(groupId, { windowId, index }, (group) => {
	        if (chrome.runtime.lastError) {
	          console.error(chrome.runtime.lastError.message);
	          reject(chrome.runtime.lastError.message);
	        } else {
	          resolve(group);
	        }
	      });
	    });
	  }

	  link.addEventListener('click', async () => {
	    const data = items[key];
		// console.log("Restoring data: ", data); // debug line
	    const tabData = data.tabs;

	    // Sort tabs by tabIndex before creating them
	    tabData.sort((a, b) => a.tabIndex - b.tabIndex);

	    // Create a new window and focus it
		chrome.windows.create({ focused: true }, async (newWindow) => {
		  const initialTabId = newWindow.tabs[0].id; // Capture the initial tab's ID
	      chrome.windows.update(newWindow.id, { focused: true });

	      let groupIdMapping = {};
	      let tabIdMapping = [];
		  let groupIndexMapping = {};
		  
		  // Array to hold the groups to be moved
		  let groupsToMove = [];


	      // Create tabs one by one
	      for (let i = 0; i < tabData.length; i++) {
	        const tab = tabData[i];
	        const newTab = await createTab(tab.url, newWindow.id);
			
			// apply pinned status
			if (tab.pinned) {
			    chrome.tabs.update(newTab.id, { pinned: true });
			}			
			
			// console.log("Created new tab: ", newTab); // debug line
	        tabIdMapping.push(newTab.id);

	        const groupInfo = data.groups.find((group) => group.id === tab.groupId);
	        if (groupInfo) {
	          if (!groupIdMapping[groupInfo.id]) {
	            const groupId = await createGroup(newTab.id);
	            groupIdMapping[groupInfo.id] = groupId;
				
				groupIndexMapping[groupInfo.id] = groupInfo.position + 1
				groupsToMove.push({ groupId, correctPosition: groupIndexMapping[groupInfo.id] });
				
	            chrome.tabGroups.update(groupId, { color: groupInfo.color, title: groupInfo.title });
	          } else {
	            chrome.tabs.group({ groupId: groupIdMapping[groupInfo.id], tabIds: newTab.id });
	          }

	        }
	      }
		  
		  // Sort the groupsToMove array in ascending order of correctPosition
		  groupsToMove.sort((a, b) => a.correctPosition - b.correctPosition);		  
		  
		  
		  // Move groups after all tabs have been created and grouped
		  for (let group of groupsToMove) {
		    await moveGroup(group.groupId, newWindow.id, group.correctPosition).catch((err) => {
		      console.error("Error when moving group: ", err);
		    });
		    // console.log("Moving group id: ", group.groupId, " | to position:", group.correctPosition); // debug line
		  }


	      // Update group collapsed state after all tabs have been created
	      Object.entries(groupIdMapping).forEach(([originalGroupId, newGroupId]) => {
	        const groupInfo = data.groups.find((group) => group.id === Number(originalGroupId));
	        if (groupInfo && groupInfo.collapsed) {
	          chrome.tabGroups.update(newGroupId, { collapsed: groupInfo.collapsed });
	        }
	      });

	      // After all tabs have been created, set the active tab
	      chrome.tabs.update(tabIdMapping[data.activeTabIndex], { active: true });
		  
		  // Close the default tab:
		  chrome.tabs.remove(initialTabId);
	    });
	  });
	  
      const deleteButton = document.createElement('button');
      deleteButton.textContent = 'x';
      deleteButton.addEventListener('click', () => {
        chrome.storage.sync.remove(key);
        linkWrapper.remove();
      });

      // Add the "edit" button
      const editButton = document.createElement('button');
      editButton.textContent = 'edit';
      editButton.addEventListener('click', () => {
        const newName = prompt('Enter a new name for the Nest:', link.textContent);
        if (newName !== null && newName !== '') {
          const updatedData = { ...items[key], name: newName };
          chrome.storage.sync.set({ [key]: updatedData }, () => {
            link.textContent = newName;
          });
        }
      });
	  
      // Add the "update" button
      const updateButton = document.createElement('button');
	  updateButton.innerHTML = '&#8618;';
      //updateButton.textContent = 'update';
	  updateButton.addEventListener('click', async () => {
	    // First, remove the existing saved data
	    chrome.storage.sync.remove(key);
	    // Now, just execute the same logic as the "save" button
	    const currentWindow = await chrome.windows.getCurrent({ populate: true });
	    const urls = currentWindow.tabs.map(tab => tab.url);
	    const activeTab = currentWindow.tabs.find(tab => tab.active);
	    // const truncatedTitle = activeTab.title.substring(0, 30); // Truncate the title if it's too long
  
	    // Prompt the user for a custom name for the group
	    const title = link.textContent;

	    // Send a message to the background script and wait for a response before closing the window
	    chrome.runtime.sendMessage({ action: 'saveTabs', urls, title, windowId: currentWindow.id }, async () => {
	      // Close the active window after saving the tabs and receiving a response
	      chrome.windows.remove(currentWindow.id);

	      // Update the display after closing the active window
	      renderSavedTabs();
	    });
	  });
	  
      linkButtonContainer.appendChild(link);
	  linkButtonContainer.appendChild(updateButton); // Add the "update" button to the container
      linkButtonContainer.appendChild(editButton); // Add the "edit" button to the container
	  linkButtonContainer.appendChild(deleteButton);
      linkWrapper.appendChild(linkButtonContainer);
      savedTabsContainer.appendChild(linkWrapper);
    }
  });
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync') {
    renderSavedTabs();
  }
});

renderSavedTabs();
