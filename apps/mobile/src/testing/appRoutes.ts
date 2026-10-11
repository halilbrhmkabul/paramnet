import RootLayout from "../../app/_layout";
import AuthLayout from "../../app/(auth)/_layout";
import Notifications from "../../app/(auth)/notifications";
import Otp from "../../app/(auth)/otp";
import Phone from "../../app/(auth)/phone";
import Profile from "../../app/(auth)/profile";
import Welcome from "../../app/(auth)/welcome";
import TabsLayout from "../../app/(tabs)/_layout";
import Add from "../../app/(tabs)/add";
import Calendar from "../../app/(tabs)/calendar";
import Contacts from "../../app/(tabs)/contacts";
import Home from "../../app/(tabs)/index";
import Requests from "../../app/(tabs)/requests";
import Index from "../../app/index";
import AgreementHistory from "../../app/agreement/[id]/history";
import AgreementDetail from "../../app/agreement/[id]/index";
import AgreementPayment from "../../app/agreement/[id]/payment";
import ContactDetail from "../../app/contact/[id]";
import NewLayout from "../../app/new/_layout";
import NewForm from "../../app/new/form";
import NewIndex from "../../app/new/index";
import NewPlan from "../../app/new/plan";

// Every route of the app for expo-router's renderRouter; extend when a route file is added.
export const appRoutes = {
	_layout: RootLayout,
	index: Index,
	"(auth)/_layout": AuthLayout,
	"(auth)/welcome": Welcome,
	"(auth)/phone": Phone,
	"(auth)/otp": Otp,
	"(auth)/profile": Profile,
	"(auth)/notifications": Notifications,
	"(tabs)/_layout": TabsLayout,
	"(tabs)/index": Home,
	"(tabs)/contacts": Contacts,
	"(tabs)/add": Add,
	"(tabs)/calendar": Calendar,
	"(tabs)/requests": Requests,
	"new/_layout": NewLayout,
	"new/index": NewIndex,
	"new/form": NewForm,
	"new/plan": NewPlan,
	"agreement/[id]/index": AgreementDetail,
	"agreement/[id]/payment": AgreementPayment,
	"agreement/[id]/history": AgreementHistory,
	"contact/[id]": ContactDetail,
};
