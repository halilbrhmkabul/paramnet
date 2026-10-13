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
import Contacts from "../../app/contacts";
import Debts from "../../app/(tabs)/debts";
import Home from "../../app/(tabs)/index";
import Requests from "../../app/requests";
import Cards from "../../app/(tabs)/cards";
import Index from "../../app/index";
import Invite from "../../app/invite/[token]";
import AgreementAmend from "../../app/agreement/[id]/amend";
import AgreementDispute from "../../app/agreement/[id]/dispute";
import AgreementDecide from "../../app/agreement/[id]/decide";
import AgreementHistory from "../../app/agreement/[id]/history";
import AgreementDetail from "../../app/agreement/[id]/index";
import AgreementInvitePreview from "../../app/agreement/[id]/invite-preview";
import AgreementPayment from "../../app/agreement/[id]/payment";
import AgreementShare from "../../app/agreement/[id]/share";
import ContactDetail from "../../app/contact/[id]";
import NewLayout from "../../app/new/_layout";
import NewForm from "../../app/new/form";
import NewIndex from "../../app/new/index";
import NewPlan from "../../app/new/plan";
import Settings from "../../app/settings/index";
import SettingsDelete from "../../app/settings/delete";
import Legal from "../../app/legal/[doc]";

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
	"(tabs)/debts": Debts,
	contacts: Contacts,
	"(tabs)/add": Add,
	"(tabs)/calendar": Calendar,
	requests: Requests,
	"(tabs)/cards": Cards,
	"new/_layout": NewLayout,
	"new/index": NewIndex,
	"new/form": NewForm,
	"new/plan": NewPlan,
	"agreement/[id]/index": AgreementDetail,
	"agreement/[id]/payment": AgreementPayment,
	"agreement/[id]/history": AgreementHistory,
	"agreement/[id]/decide": AgreementDecide,
	"agreement/[id]/amend": AgreementAmend,
	"agreement/[id]/dispute": AgreementDispute,
	"agreement/[id]/share": AgreementShare,
	"agreement/[id]/invite-preview": AgreementInvitePreview,
	"contact/[id]": ContactDetail,
	"settings/index": Settings,
	"settings/delete": SettingsDelete,
	"legal/[doc]": Legal,
	"invite/[token]": Invite,
};
