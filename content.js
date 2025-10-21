(function() {
    'use strict';
    
    let groups = [];
    let isInitialized = false;
    let observer = null;
    let retryCount = 0;
    const maxRetries = 10;
    
    function loadGroups() {
        try {
            chrome.storage.local.get(['groups'], function(result) {
                if (chrome.runtime.lastError) {
                    console.log('Extension context invalidated, stopping execution');
                    return;
                }
                groups = result.groups || [];
                if (isInitialized) {
                    updateFollowingList();
                }
            });
        } catch (error) {
            console.log('Extension context invalidated, stopping execution');
            return;
        }
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
        
        // Use event delegation to prevent issues with dynamic content
        groupDiv.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Don't toggle if clicking buttons or their children
            const isButtonClick = e.target.closest('.group-tv-delete-btn') || 
                                 e.target.closest('.group-tv-add-streamer-btn') ||
                                 e.target.classList.contains('group-tv-delete-btn') || 
                                 e.target.classList.contains('group-tv-add-streamer-btn');
            
            if (!isButtonClick) {
                toggleGroupVisibility(group.id);
            }
        });
        
        // Add delete button handler with proper event handling
        const deleteBtn = groupDiv.querySelector('.group-tv-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                deleteGroup(group.id);
            });
        }
        
        // Add streamer button handler with proper event handling
        const addStreamerBtn = groupDiv.querySelector('.group-tv-add-streamer-btn');
        if (addStreamerBtn) {
            addStreamerBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                addStreamerToGroup(group.id);
            });
        }
        
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
            streamerDiv.setAttribute('data-streamer-name', streamer.name);
            
            streamerDiv.innerHTML = `
                <span>${streamer.name}</span>
                <div class="group-tv-live-indicator offline" data-streamer="${streamer.name}"></div>
            `;
            
            streamerDiv.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
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
    
    //update the following list
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
        
        // Remove ALL existing group elements completely
        const existingWrappers = document.querySelectorAll('.group-tv-wrapper');
        existingWrappers.forEach(wrapper => wrapper.remove());
        
        // Also remove any orphaned group elements
        const orphanedGroups = document.querySelectorAll('.group-tv-custom-group, .group-tv-streamers');
        orphanedGroups.forEach(element => element.remove());
        
        // Wait a bit to ensure DOM is clean before adding new elements
        setTimeout(() => {
            groups.forEach(group => {
                const groupElement = createGroupElement(group);
                const streamersElement = createStreamerElements(group);
                
                // Create a wrapper div to keep group and streamers together
                const groupWrapper = document.createElement('div');
                groupWrapper.className = 'group-tv-wrapper';
                groupWrapper.appendChild(groupElement);
                groupWrapper.appendChild(streamersElement);
                
                // Insert at the very beginning
                followingList.insertBefore(groupWrapper, followingList.firstChild);
            });
            
            // Update live status indicators after creating the elements
            setTimeout(updateLiveStatusIndicators, 500);
        }, 100);
    }
    
    // Function to toggle group visibility
    function toggleGroupVisibility(groupId) {
        const streamersContainer = document.querySelector(`.group-tv-streamers[data-group-id="${groupId}"]`);
        
        if (streamersContainer) {
            const isVisible = streamersContainer.classList.contains('show');
            
            if (isVisible) {
                streamersContainer.classList.remove('show');
            } else {
                streamersContainer.classList.add('show');
                // Update live status when showing streamers
                setTimeout(updateLiveStatusIndicators, 100);
            }
        }
    }
    
    // Function to delete a group
    function deleteGroup(groupId) {
        if (confirm('Are you sure you want to delete this group?')) {
            groups = groups.filter(group => group.id !== groupId);
            
            try {
                chrome.storage.local.set({groups: groups}, function() {
                    if (chrome.runtime.lastError) {
                        console.log('Extension context invalidated, stopping execution');
                        return;
                    }
                    updateFollowingList();
                });
            } catch (error) {
                console.log('Extension context invalidated, stopping execution');
                return;
            }
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
        
        try {
            chrome.storage.local.set({groups: groups}, function() {
                if (chrome.runtime.lastError) {
                    console.log('Extension context invalidated, stopping execution');
                    return;
                }
                updateFollowingList();
            });
        } catch (error) {
            console.log('Extension context invalidated, stopping execution');
            return;
        }
    }
    
    // Function to check if a streamer is live using multiple methods
    async function checkStreamerLiveStatus(streamerName) {
        try {
            // Method 1: Try Twitch's GraphQL API
            try {
                const query = {
                    query: `
                        query {
                            user(login: "${streamerName}") {
                                stream {
                                    id
                                }
                            }
                        }
                    `
                };
                
                const response = await fetch('https://gql.twitch.tv/gql', {
                    method: 'POST',
                    headers: {
                        'Client-ID': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(query)
                });
                
                if (response.ok) {
                    const data = await response.json();
                    const isLive = data.data && data.data.user && data.data.user.stream && data.data.user.stream.id;
                    return isLive;
                }
            } catch (gqlError) {
                // GraphQL failed, try fallback methods
            }
            
            // Method 2: Check if we're on the streamer's page and they have live elements
            if (window.location.pathname === `/${streamerName}`) {
                const liveElements = document.querySelectorAll(`
                    [data-a-target="stream-info-card-live-indicator"],
                    [data-a-target="live-indicator"],
                    .live-indicator,
                    [class*="liveIndicator"],
                    .viewer-count,
                    .viewer-count-text,
                    [data-a-target="viewer-count"]
                `);
                
                if (liveElements.length > 0) {
                    return true;
                }
            }
            
            // Method 3: Look for the streamer in Twitch's live sections
            const liveSections = document.querySelectorAll(`
                [data-a-target="recommended-channels"],
                [data-testid="recommended-channels"],
                .side-nav-section,
                [data-a-target="side-nav"]
            `);
            
            for (const section of liveSections) {
                const streamerLinks = section.querySelectorAll(`a[href*="/${streamerName}"]`);
                
                for (const link of streamerLinks) {
                    const parentContainer = link.closest('div, li, section');
                    if (parentContainer) {
                        const liveIndicators = parentContainer.querySelectorAll(`
                            [data-a-target="stream-info-card-live-indicator"],
                            [data-a-target="live-indicator"],
                            .live-indicator,
                            [class*="liveIndicator"]
                        `);
                        
                        if (liveIndicators.length > 0) {
                            return true;
                        }
                    }
                }
            }
            
            return false;
            
        } catch (error) {
            return false;
        }
    }
    
    // Rate limiting for API calls
    let lastApiCall = 0;
    const apiCallDelay = 200; // 200ms between API calls to respect rate limits
    
    // Function to update live status indicators for all visible streamers
    async function updateLiveStatusIndicators() {
        // Only update indicators that are visible (in expanded groups)
        const visibleIndicators = document.querySelectorAll('.group-tv-streamers.show .group-tv-live-indicator');
        
        if (visibleIndicators.length === 0) {
            return;
        }
        
        // Process streamers sequentially to respect rate limits
        for (const indicator of visibleIndicators) {
            const streamerName = indicator.getAttribute('data-streamer');
            if (streamerName) {
                try {
                    // Rate limiting: wait if needed
                    const now = Date.now();
                    const timeSinceLastCall = now - lastApiCall;
                    if (timeSinceLastCall < apiCallDelay) {
                        await new Promise(resolve => setTimeout(resolve, apiCallDelay - timeSinceLastCall));
                    }
                    
                    const isLive = await checkStreamerLiveStatus(streamerName);
                    lastApiCall = Date.now();
                    
                    // Update the indicator with proper classes
                    indicator.className = `group-tv-live-indicator ${isLive ? 'live' : 'offline'}`;
                } catch (error) {
                    // Set to offline on error
                    indicator.className = 'group-tv-live-indicator offline';
                }
            }
        }
    }
    
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
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // Initialize the extension
    function init() {
        // Prevent multiple initializations
        if (window.groupTvInitializing) {
            return;
        }
        window.groupTvInitializing = true;
        
        // Clean up existing observers and timeouts
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        
        if (window.groupTvUpdateTimeout) {
            clearTimeout(window.groupTvUpdateTimeout);
            window.groupTvUpdateTimeout = null;
        }
        
        // Remove all existing elements first
        const existingWrappers = document.querySelectorAll('.group-tv-wrapper');
        existingWrappers.forEach(wrapper => wrapper.remove());
        
        // Also remove any orphaned group elements
        const orphanedGroups = document.querySelectorAll('.group-tv-custom-group, .group-tv-streamers');
        orphanedGroups.forEach(element => element.remove());
        
        loadGroups();
        updateFollowingList();
        setupObserver();
        isInitialized = true;
        
        // Reset initialization flag
        window.groupTvInitializing = false;
        
        // Listen for storage changes (only add once)
        if (!window.groupTvStorageListenerAdded) {
            try {
                chrome.storage.onChanged.addListener(function(changes, namespace) {
                    if (chrome.runtime.lastError) {
                        console.log('Extension context invalidated, stopping execution');
                        return;
                    }
                    if (namespace === 'local' && changes.groups) {
                        groups = changes.groups.newValue || [];
                        updateFollowingList();
                    }
                });
                window.groupTvStorageListenerAdded = true;
            } catch (error) {
                console.log('Extension context invalidated, stopping execution');
                return;
            }
        }
    }
    
    // Wait for page to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    let lastUrl = location.href;
    let navigationTimeout = null;
    
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            
            // Clear any existing timeout
            if (navigationTimeout) {
                clearTimeout(navigationTimeout);
            }
            
            // Small delay to let Twitch's SPA navigation complete
            navigationTimeout = setTimeout(() => {
                // Only reinitialize if we're on a different page
                if (location.href !== lastUrl) {
                    return;
                }
                init();
            }, 800);
        }
    }).observe(document, {subtree: true, childList: true});
    
    // Periodic check to ensure groups stay visible and update live status
    setInterval(() => {
        if (isInitialized && groups.length > 0) {
            const existingGroups = document.querySelectorAll('.group-tv-custom-group');
            if (existingGroups.length === 0) {
                updateFollowingList();
            } else {
                // Only update if there are visible streamers
                const visibleIndicators = document.querySelectorAll('.group-tv-streamers.show .group-tv-live-indicator');
                if (visibleIndicators.length > 0) {
                    updateLiveStatusIndicators();
                }
            }
        }
    }, 5000); // Increased interval to reduce interference
    
})();