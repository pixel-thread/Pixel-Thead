/**
 * Shared Regular Expressions for Validation
 */
export const VALIDATION_PATTERNS = {
  // Only letters, spaces, and hyphens (standard for names)
  NAME: /^[a-zA-Z\s\-]+$/,

  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, and 1 special character
  PASSWORD:
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/,

  // Standard identifier (alphanumeric, underscores, hyphens)
  SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
};
