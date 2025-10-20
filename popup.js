// Basic popup functionality for managing groups
document.addEventListener('DOMContentLoaded', function() {
    const addGroupBtn = document.getElementById('addGroupBtn');
    const groupsList = document.getElementById('groupsList');
    
    // Load existing groups
    loadGroups();
    
    // Add new group button
    addGroupBtn.addEventListener('click', function() {
        const groupName = prompt('Enter group name:');
        if (groupName && groupName.trim()) {
            createGroup(groupName.trim());
        }
    });
    
    // Load groups from storage
    function loadGroups() {
        chrome.storage.local.get(['groups'], function(result) {
            const groups = result.groups || [];
            displayGroups(groups);
        });
    }
    
    // Create a new group
    function createGroup(name) {
        chrome.storage.local.get(['groups'], function(result) {
            const groups = result.groups || [];
            const newGroup = {
                id: Date.now().toString(),
                name: name,
                streamers: []
            };
            groups.push(newGroup);
            
            chrome.storage.local.set({groups: groups}, function() {
                displayGroups(groups);
            });
        });
    }
    
    // Display groups in the popup
    function displayGroups(groups) {
        groupsList.innerHTML = '';
        
        groups.forEach(group => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'group-item';
            groupDiv.innerHTML = `
                <div>
                    <div class="group-name">${group.name}</div>
                    <div class="streamer-count">${group.streamers.length} streamers</div>
                </div>
                <button onclick="deleteGroup('${group.id}')" style="background: #ff4444; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Delete</button>
            `;
            groupsList.appendChild(groupDiv);
        });
    }
    
    // Delete a group
    window.deleteGroup = function(groupId) {
        if (confirm('Are you sure you want to delete this group?')) {
            chrome.storage.local.get(['groups'], function(result) {
                const groups = result.groups || [];
                const updatedGroups = groups.filter(group => group.id !== groupId);
                
                chrome.storage.local.set({groups: updatedGroups}, function() {
                    displayGroups(updatedGroups);
                });
            });
        }
    };
});
