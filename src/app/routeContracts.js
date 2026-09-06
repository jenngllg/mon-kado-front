export const RouteNames = Object.freeze({
  Home: "home",
  Login: "login",
  LinkGoogle: "link-google",
  Register: "register",
  ConfirmEmail: "confirm-email",
  ConfirmEmailChange: "confirm-email-change",
  ForgotPassword: "forgot-password",
  ResetPassword: "reset-password",
  Profile: "profile",
  PasswordChange: "password-change",
  Lists: "lists",
  NewList: "new-list",
  ListDetails: "list-details",
  Reservations: "reservations",
  SharedWishlist: "shared-wishlist",
});

export const RoutePaths = Object.freeze({
  Home: "/",
  Login: "/login",
  LinkGoogle: "/login/link-google",
  Register: "/register",
  ConfirmEmail: "/confirm-email",
  ConfirmEmailChange: "/confirm-email-change",
  ForgotPassword: "/forgot-password",
  ResetPassword: "/reset-password",
  Profile: "/profile",
  PasswordChange: "/profile/password",
  Lists: "/lists",
  NewList: "/lists/new",
  ListDetails: "/lists/:listId",
  Reservations: "/reservations",
  SharedWishlist: "/shared-wishlists/:shareLinkId",
});

export const NavigationItems = Object.freeze([
  Object.freeze({
    label: "Accueil",
    href: RoutePaths.Home,
    routeName: RouteNames.Home,
  }),
  Object.freeze({
    label: "Mes listes",
    href: RoutePaths.Lists,
    routeName: RouteNames.Lists,
  }),
  Object.freeze({
    label: "Mes réservations",
    href: RoutePaths.Reservations,
    routeName: RouteNames.Reservations,
  }),
  Object.freeze({
    label: "Mon profil",
    href: RoutePaths.Profile,
    routeName: RouteNames.Profile,
  }),
  Object.freeze({
    label: "Connexion",
    href: RoutePaths.Login,
    routeName: RouteNames.Login,
  }),
  Object.freeze({
    label: "S’inscrire",
    href: RoutePaths.Register,
    routeName: RouteNames.Register,
  }),
]);
