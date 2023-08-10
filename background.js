chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveTabs') {
    const timestamp = new Date().getTime();

    chrome.windows.get(request.windowId, { populate: true }, (currentWindow) => {
      chrome.tabGroups.query({ windowId: request.windowId }, (groups) => {
        const tabs = currentWindow.tabs.map(tab => ({ url: tab.url, groupId: tab.groupId, active: tab.active, pinned: tab.pinned }));
		
		// const groupData = groups.map(group => ({ title: group.title, color: group.color, id: group.id, collapsed: group.collapsed }));
		const groupData = groups.map(group => {
		    const firstTabInGroupIndex = currentWindow.tabs.findIndex(tab => tab.groupId === group.id);
		    return { 
		        title: group.title, 
		        color: group.color, 
		        id: group.id, 
		        collapsed: group.collapsed, 
		        position: firstTabInGroupIndex
		    };
		});
		
		
        const activeTabIndex = tabs.findIndex(tab => tab.active);
        
        const data = {
          tabs,
          name: request.title, // No need to append date and tab count here
          groups: groupData,
          activeTabIndex,
        };
        
        // console.log("Saved data: ", data); // debug line
        
        chrome.storage.sync.set({ [timestamp]: data }, () => {
          sendResponse({ success: true });
        });
      });
    });
    return true;
  }
});