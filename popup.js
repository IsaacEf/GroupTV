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
            
            // Create icon element
            const iconElement = group.iconUrl ? 
                `<img src="${group.iconUrl}" class="group-icon" alt="Group icon">` :
                `<div class="group-icon" style="background: #ddd; display: flex; align-items: center; justify-content: center; font-size: 12px; border-radius: 50%;">📁</div>`;
            
            groupDiv.innerHTML = `
                <div class="group-info">
                    ${iconElement}
                    <div class="group-details">
                        <div class="group-name">${group.name}</div>
                        <div class="streamer-count">${group.streamers.length} streamers</div>
                    </div>
                </div>
                <div class="group-actions">
                    <button class="icon-upload-btn" data-group-id="${group.id}">📷</button>
                    ${group.iconUrl ? `<button class="remove-icon-btn" data-group-id="${group.id}">🗑️</button>` : ''}
                    <button class="delete-btn" data-group-id="${group.id}">Delete</button>
                </div>
            `;
            groupsList.appendChild(groupDiv);
        });
        
        // Add event listeners after creating the elements
        addEventListeners();
    }
    
    // Add event listeners to the buttons
    function addEventListeners() {
        // Upload icon buttons
        document.querySelectorAll('.icon-upload-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const groupId = this.getAttribute('data-group-id');
                uploadIcon(groupId);
            });
        });
        
        // Remove icon buttons
        document.querySelectorAll('.remove-icon-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const groupId = this.getAttribute('data-group-id');
                removeIcon(groupId);
            });
        });
        
        // Delete buttons
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const groupId = this.getAttribute('data-group-id');
                deleteGroup(groupId);
            });
        });
    }
    
    // Delete a group
    function deleteGroup(groupId) {
        if (confirm('Are you sure you want to delete this group?')) {
            chrome.storage.local.get(['groups'], function(result) {
                const groups = result.groups || [];
                const updatedGroups = groups.filter(group => group.id !== groupId);
                
                chrome.storage.local.set({groups: updatedGroups}, function() {
                    displayGroups(updatedGroups);
                });
            });
        }
    }
    
    // Upload icon for a group
    window.uploadIcon = function(groupId) {
        // Create a temporary file input
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        
        fileInput.addEventListener('change', function(e) {
            handleIconUpload(groupId, this);
            // Clean up the temporary input
            document.body.removeChild(fileInput);
        });
        
        // Add to DOM temporarily and trigger click
        document.body.appendChild(fileInput);
        fileInput.click();
    };
    
    // Handle icon upload
    window.handleIconUpload = function(groupId, input) {
        const file = input.files[0];
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                alert('Please select a valid image file.');
                return;
            }
            
            // Validate file size (max 2MB)
            if (file.size > 2 * 1024 * 1024) {
                alert('Image file is too large. Please select an image smaller than 2MB.');
                return;
            }
            
            // Convert to base64
            const reader = new FileReader();
            reader.onload = function(e) {
                const iconUrl = e.target.result;
                updateGroupIcon(groupId, iconUrl);
            };
            reader.readAsDataURL(file);
        }
    };
    
    // Update group icon
    function updateGroupIcon(groupId, iconUrl) {
        chrome.storage.local.get(['groups'], function(result) {
            const groups = result.groups || [];
            const groupIndex = groups.findIndex(group => group.id === groupId);
            
            if (groupIndex !== -1) {
                groups[groupIndex].iconUrl = iconUrl;
                
                chrome.storage.local.set({groups: groups}, function() {
                    displayGroups(groups);
                });
            }
        });
    }
    
    // Remove icon from group
    function removeIcon(groupId) {
        if (confirm('Remove custom icon and use default folder icon?')) {
            chrome.storage.local.get(['groups'], function(result) {
                const groups = result.groups || [];
                const groupIndex = groups.findIndex(group => group.id === groupId);
                
                if (groupIndex !== -1) {
                    delete groups[groupIndex].iconUrl;
                    
                    chrome.storage.local.set({groups: groups}, function() {
                        displayGroups(groups);
                    });
                }
            });
        }
    }
});
