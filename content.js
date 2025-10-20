// Content script to inject groups into Twitch following list
(function() {
    'use strict';
    
    let groups = [];
    let isInitialized = false;
    let observer = null;
    let retryCount = 0;
    const maxRetries = 10;
    
    // Function to load groups from storage
    function loadGroups() {
        chrome.storage.local.get(['groups'], function(result) {
            groups = result.groups || [];
            if (isInitialized) {
                updateFollowingList();
            }
        });
    }
    
    // Function to create group element
    function createGroupElement(group) {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'group-tv-custom-group';
        
        groupDiv.innerHTML = `
            <div class="group-tv-group-content">
                <span class="group-tv-group-icon">📁</span>
                <span>${group.name}</span>
                <span class="group-tv-group-count">(${group.streamers.length})</span>
            </div>
        `;
        
        // Add click handler to toggle group visibility
        groupDiv.addEventListener('click', () => {
            toggleGroupVisibility(group.id);
        });
        
        return groupDiv;
    }
    
    // Function to create streamer elements for a group
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
    
    // Function to find the following list with multiple selectors
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
        const streamersContainer = document.querySelector(`[data-group-id="${groupId}"]`);
        if (streamersContainer) {
            const isVisible = streamersContainer.style.display !== 'none';
            streamersContainer.style.display = isVisible ? 'none' : 'block';
        }
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