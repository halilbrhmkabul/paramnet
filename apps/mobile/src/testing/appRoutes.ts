import RootLayout from "../../app/_layout";
import AuthLayout from "../../app/(auth)/_layout";
import Notifications from "../../app/(auth)/notifications";
import Otp from "../../app/(auth)/otp";
import Login from "../../app/(auth)/login";
import OnboardingRoute from "../../app/(auth)/onboarding";
import Pin from "../../app/(auth)/pin";
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
import Me from "../../app/me/index";
import MeDelete from "../../app/me/delete";
import MeDiscoverability from "../../app/me/discoverability";
import MeEdit from "../../app/me/edit";
import MeLegal from "../../app/me/legal";
import Menu from "../../app/menu";
import Inbox from "../../app/inbox";
import Legal from "../../app/legal/[doc]";
import Accounts from "../../app/accounts/index";
import AccountNew from "../../app/accounts/new";
import AccountEdit from "../../app/accounts/[id]/edit";
import AccountAdjust from "../../app/accounts/[id]/adjust";
import TransactionNew from "../../app/transaction/new";
import TransactionEdit from "../../app/transaction/[id]/edit";
import TransactionDetail from "../../app/transaction/[id]/index";
import Transactions from "../../app/transactions";
import Recurring from "../../app/recurring/index";
import RecurringNew from "../../app/recurring/new";
import RecurringEdit from "../../app/recurring/[id]";
import Budget from "../../app/budget";
import Reports from "../../app/reports";
import CardNew from "../../app/cards/new";
import CardDetail from "../../app/cards/[id]/index";
import CardEdit from "../../app/cards/[id]/edit";
import CardPay from "../../app/cards/[id]/pay";
import CardPaid from "../../app/cards/[id]/paid";
import Loans from "../../app/loans/index";
import LoanNew from "../../app/loans/new";
import LoanDetail from "../../app/loans/[id]/index";
import LoanEdit from "../../app/loans/[id]/edit";
import LoanPay from "../../app/loans/[id]/pay";
import Interest from "../../app/interest";
import RequestMoney from "../../app/request/index";
import RequestSent from "../../app/request/sent";
import AgreementDelivery from "../../app/agreement/[id]/delivery";

// Every route of the app for expo-router's renderRouter; extend when a route file is added.
export const appRoutes = {
	_layout: RootLayout,
	index: Index,
	"(auth)/_layout": AuthLayout,
	"(auth)/welcome": Welcome,
	"(auth)/onboarding": OnboardingRoute,
	"(auth)/login": Login,
	"(auth)/pin": Pin,
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
	"me/index": Me,
	"me/edit": MeEdit,
	"me/discoverability": MeDiscoverability,
	"me/legal": MeLegal,
	"me/delete": MeDelete,
	menu: Menu,
	"accounts/index": Accounts,
	"accounts/new": AccountNew,
	"accounts/[id]/edit": AccountEdit,
	"accounts/[id]/adjust": AccountAdjust,
	"transaction/new": TransactionNew,
	"transaction/[id]/edit": TransactionEdit,
	"transaction/[id]/index": TransactionDetail,
	transactions: Transactions,
	"recurring/index": Recurring,
	"recurring/new": RecurringNew,
	"recurring/[id]": RecurringEdit,
	budget: Budget,
	reports: Reports,
	"cards/new": CardNew,
	"cards/[id]/index": CardDetail,
	"cards/[id]/edit": CardEdit,
	"cards/[id]/pay": CardPay,
	"cards/[id]/paid": CardPaid,
	"loans/index": Loans,
	"loans/new": LoanNew,
	"loans/[id]/index": LoanDetail,
	"loans/[id]/edit": LoanEdit,
	"loans/[id]/pay": LoanPay,
	interest: Interest,
	"request/index": RequestMoney,
	"request/sent": RequestSent,
	"agreement/[id]/delivery": AgreementDelivery,
	inbox: Inbox,
	"legal/[doc]": Legal,
	"invite/[token]": Invite,
};
