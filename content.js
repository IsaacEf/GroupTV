(function() {
    'use strict';
    
    let groups = [];
    let isInitialized = false;
    let observer = null;
    let retryCount = 0;
    const maxRetries = 10;
    
    function loadGroups() {
        chrome.storage.local.get(['groups'], function(result) {
            groups = result.groups || [];
            if (isInitialized) {
                updateFollowingList();
            }
        });
    }
    
    function createGroupElement(group) {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'group-tv-custom-group';
        
        groupDiv.innerHTML = `
            <div class="group-tv-group-content">
                <span class="group-tv-group-icon">📁</span>
                <span>${group.name}</span>
                <span class="group-tv-group-count">(${group.streamers.length})</span>
            </div>
            <div class="group-tv-group-actions">
                <button class="group-tv-add-streamer-btn" data-group-id="${group.id}">+</button>
                <button class="group-tv-delete-btn" data-group-id="${group.id}">×</button>
            </div>
        `;
        
        groupDiv.addEventListener('click', (e) => {
            // Don't toggle if clicking buttons or their children
            const isButtonClick = e.target.closest('.group-tv-delete-btn') || 
                                 e.target.closest('.group-tv-add-streamer-btn') ||
                                 e.target.classList.contains('group-tv-delete-btn') || 
                                 e.target.classList.contains('group-tv-add-streamer-btn');
            
            if (!isButtonClick) {
                console.log('Group clicked, toggling visibility for:', group.id);
                toggleGroupVisibility(group.id);
            }
        });
        
        // Add delete button handler
        const deleteBtn = groupDiv.querySelector('.group-tv-delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteGroup(group.id);
        });
        
        // Add streamer button handler
        const addStreamerBtn = groupDiv.querySelector('.group-tv-add-streamer-btn');
        addStreamerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            addStreamerToGroup(group.id);
        });
        
        return groupDiv;
    }
    
    //create streamer elements for a group
    function createStreamerElements(group) {
        const streamersContainer = document.createElement('div');
        streamersContainer.className = 'group-tv-streamers';
        streamersContainer.setAttribute('data-group-id', group.id);
        
        group.streamers.forEach(streamer => {
            const streamerDiv = document.createElement('div');
            streamerDiv.className = 'group-tv-streamer';
            
            streamerDiv.innerHTML = `
                <span>${streamer.name}</span>
            `;
            
            // Click to visit streamer
            streamerDiv.addEventListener('click', () => {
                window.open(`https://www.twitch.tv/${streamer.name}`, '_blank');
            });
            
            streamersContainer.appendChild(streamerDiv);
        });
        
        return streamersContainer;
    }
    
    // find the following list with selectors
    function findFollowingList() {
        const selectors = [
            '[data-testid="recommended-channels"]',
            '[data-a-target="recommended-channels"]',
            '.side-nav-section',
            '[data-a-target="side-nav"]',
            '.side-nav',
            '[data-testid="side-nav"]'
        ];
        
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                return element;
            }
        }
        
        return null;
    }
    
    // Function to update the following list
    function updateFollowingList() {
        const followingList = findFollowingList();
        
        if (!followingList) {
            retryCount++;
            if (retryCount < maxRetries) {
                setTimeout(updateFollowingList, 1000);
            }
            return;
        }
        
        // Reset retry count on success
        retryCount = 0;
        
        // Remove existing group elements
        const existingGroups = document.querySelectorAll('.group-tv-custom-group');
        existingGroups.forEach(group => group.remove());
        
        // Add groups at the top
        groups.forEach(group => {
            const groupElement = createGroupElement(group);
            const streamersElement = createStreamerElements(group);
            
            // Insert at the very beginning
            followingList.insertBefore(streamersElement, followingList.firstChild);
            followingList.insertBefore(groupElement, followingList.firstChild);
        });
    }
    
    // Function to toggle group visibility
    function toggleGroupVisibility(groupId) {
        console.log('toggleGroupVisibility called with groupId:', groupId);
        const streamersContainer = document.querySelector(`.group-tv-streamers[data-group-id="${groupId}"]`);
        console.log('Found streamers container:', streamersContainer);
        
        if (streamersContainer) {
            const isVisible = streamersContainer.classList.contains('show');
            console.log('Current visibility:', isVisible);
            
            if (isVisible) {
                streamersContainer.classList.remove('show');
                console.log('Hiding streamers');
            } else {
                streamersContainer.classList.add('show');
                console.log('Showing streamers');
            }
        } else {
            console.log('Streamers container not found for group:', groupId);
            console.log('Available containers:', document.querySelectorAll('.group-tv-streamers[data-group-id]'));
        }
    }
    
    // Function to delete a group
    function deleteGroup(groupId) {
        if (confirm('Are you sure you want to delete this group?')) {
            // Remove from groups array
            groups = groups.filter(group => group.id !== groupId);
            
            // Update storage
            chrome.storage.local.set({groups: groups}, function() {
                updateFollowingList();
            });
        }
    }
    
    // Function to add streamer to group
    function addStreamerToGroup(groupId) {
        const streamerName = prompt('Enter streamer name (without @):');
        if (!streamerName || !streamerName.trim()) return;
        
        const group = groups.find(g => g.id === groupId);
        if (!group) return;
        
        // Check if streamer already exists in group
        const existingStreamer = group.streamers.find(s => s.name.toLowerCase() === streamerName.trim().toLowerCase());
        if (existingStreamer) {
            alert('This streamer is already in the group!');
            return;
        }
        
        const streamer = {
            name: streamerName.trim(),
            addedAt: Date.now()
        };
        
        group.streamers.push(streamer);
        
        chrome.storage.local.set({groups: groups}, function() {
            updateFollowingList();
        });
    }
    
    // Function to setup persistent observer
    function setupObserver() {
        if (observer) {
            observer.disconnect();
        }
        
        observer = new MutationObserver(function(mutations) {
            let shouldUpdate = false;
            
            mutations.forEach(function(mutation) {
                // Check if our groups were removed
                if (mutation.type === 'childList') {
                    const removedNodes = Array.from(mutation.removedNodes);
                    const hasOurGroups = removedNodes.some(node => 
                        node.nodeType === Node.ELEMENT_NODE && 
                        (node.classList?.contains('group-tv-custom-group') || 
                         node.querySelector?.('.group-tv-custom-group'))
                    );
                    
                    if (hasOurGroups) {
                        shouldUpdate = true;
                    }
                }
            });
            
            if (shouldUpdate) {
                // Debounce updates
                clearTimeout(window.groupTvUpdateTimeout);
                window.groupTvUpdateTimeout = setTimeout(updateFollowingList, 100);
            }
        });
        
        // Observe the entire document for changes
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // Initialize the extension
    function init() {
        if (isInitialized) return;
        
        loadGroups();
        updateFollowingList();
        setupObserver();
        isInitialized = true;
        
        // Listen for storage changes
        chrome.storage.onChanged.addListener(function(changes, namespace) {
            if (namespace === 'local' && changes.groups) {
                groups = changes.groups.newValue || [];
                updateFollowingList();
            }
        });
    }
    
    // Wait for page to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Also initialize when navigating (for SPA behavior)
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            isInitialized = false;
            setTimeout(init, 1000);
        }
    }).observe(document, {subtree: true, childList: true});
    
    // Periodic check to ensure groups stay visible
    setInterval(() => {
        if (isInitialized && groups.length > 0) {
            const existingGroups = document.querySelectorAll('.group-tv-custom-group');
            if (existingGroups.length === 0) {
                updateFollowingList();
            }
        }
    }, 3000);
    
})();