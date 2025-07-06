# Light/Dark Mode Implementation

## Overview
This implementation adds a light/dark mode toggle feature to the DREC UI application. The feature allows users to switch between light and dark themes with persistent storage of their preference.

## Files Added/Modified

### New Files
1. **`src/app/shared/services/theme.service.ts`** - Core service for theme management
2. **`src/app/shared/components/theme-switcher/theme-switcher.component.ts`** - Theme switcher component
3. **`src/app/shared/components/theme-switcher/theme-switcher.component.html`** - Template for theme switcher
4. **`src/app/shared/components/theme-switcher/theme-switcher.component.scss`** - Styles for theme switcher
5. **`src/app/shared/styles/theme-variables.scss`** - CSS custom properties for theming
6. **Test files** - Unit tests for the theme service and component

### Modified Files
1. **`src/styles.scss`** - Updated to include theme variables and use CSS custom properties
2. **`src/app/shared.module.ts`** - Added theme switcher component export
3. **`src/app/nav/header/header.component.html`** - Added theme switcher to header
4. **`src/app/nav/header/header.component.scss`** - Updated to use CSS custom properties

## Features

### ✅ Theme Management Service
- Manages theme state with RxJS observables
- Persists theme preference to localStorage
- Updates document body classes for theme switching
- Provides theme toggle functionality

### ✅ Theme Switcher Component
- Clean, accessible UI with Material Design icons
- Shows appropriate icon (sun/moon) based on current theme
- Proper ARIA labels for accessibility
- Smooth transitions between themes

### ✅ CSS Custom Properties
- Light and dark theme color variables
- Maintains brand colors (primary gold #f2be1a)
- Proper contrast ratios for accessibility
- Smooth transitions for theme changes

### ✅ Responsive Design
- Works across all device sizes
- Maintains usability in both themes
- Consistent styling patterns

## Usage

The theme switcher appears in the header and allows users to:
1. Toggle between light and dark themes
2. See their preference persisted across sessions
3. Experience smooth transitions between themes

## Implementation Details

### Theme Service
```typescript
// Toggle theme
themeService.toggleTheme();

// Set specific theme
themeService.setTheme('dark');

// Subscribe to theme changes
themeService.theme$.subscribe(theme => {
  console.log('Current theme:', theme);
});
```

### CSS Custom Properties
The implementation uses CSS custom properties to enable dynamic theming:
```scss
// Light theme
:root {
  --primary-color: #f2be1a;
  --background-color: #f2f2f2;
  --text-color: #3f3f3f;
}

// Dark theme
.dark-theme {
  --primary-color: #f2be1a;
  --background-color: #121212;
  --text-color: #ffffff;
}
```

### Component Usage
```html
<!-- Add theme switcher to any component -->
<app-theme-switcher></app-theme-switcher>
```

## Testing

The implementation includes comprehensive unit tests for:
- Theme service functionality
- Theme switcher component behavior
- localStorage persistence
- Observable state management

Run tests with:
```bash
npm run test
```

## Browser Support

This implementation works with all modern browsers that support:
- CSS custom properties
- localStorage API
- ES6+ features

## Accessibility

The theme switcher includes:
- Proper ARIA labels
- Keyboard navigation support
- High contrast ratios in both themes
- Screen reader compatibility

## Future Enhancements

Potential improvements could include:
- System theme preference detection
- Additional theme variants
- Theme-specific component styling
- Animation preferences